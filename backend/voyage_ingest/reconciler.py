# voyage_ingest/reconciler.py
from __future__ import annotations

import os
import logging
from typing import Dict, List, Tuple, Optional, Set

import boto3
from google.oauth2 import service_account
from googleapiclient.discovery import build

import psycopg2

from voyage_ingest.slugger import normalize_source, president_from_voyage_slug

LOG = logging.getLogger("voyage_ingest.reconciler")

# ---------------- Env ----------------

AWS_REGION         = os.environ.get("AWS_REGION", "us-east-1")
S3_PRIVATE_BUCKET  = os.environ.get("S3_PRIVATE_BUCKET", "sequoia-canonical")
S3_PUBLIC_BUCKET   = os.environ.get("S3_PUBLIC_BUCKET",  "sequoia-public")
S3_TRASH_BUCKET    = os.environ.get("S3_TRASH_BUCKET",   "")  # optional: archive-then-delete
GOOGLE_CREDS_PATH  = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()

VOYAGES_TITLE_ENV           = "VOYAGES_SHEET_TITLE"
VOYAGE_MEDIA_TITLE_ENV      = "VOYAGE_MEDIA_SHEET_TITLE"
VOYAGE_PASSENGERS_TITLE_ENV = "VOYAGE_PASSENGERS_SHEET_TITLE"

DEFAULT_VOYAGES_TITLE           = "voyages"
DEFAULT_VOYAGE_MEDIA_TITLE      = "voyage_media"
DEFAULT_VOYAGE_PASSENGERS_TITLE = "voyage_passengers"

# ---------------- Google Sheets service ----------------

_SHEETS_SVC = None

def _sheets_service():
    global _SHEETS_SVC
    if _SHEETS_SVC is not None:
        return _SHEETS_SVC
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not creds_path or not os.path.exists(creds_path):
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS must be set for reconciler Sheets access")
    creds = service_account.Credentials.from_service_account_file(
        creds_path, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    _SHEETS_SVC = build("sheets", "v4", credentials=creds, cache_discovery=False)
    return _SHEETS_SVC

def _normalized(s: str) -> str:
    return "".join(c for c in (s or "").lower() if c.isalnum())

def _sheet_id_by_title_fuzzy(spreadsheet: dict, wanted_title: str) -> Optional[int]:
    want = _normalized(wanted_title)
    for sh in spreadsheet.get("sheets", []):
        title = sh.get("properties", {}).get("title", "")
        if _normalized(title) == want:
            return sh.get("properties", {}).get("sheetId")
    return None

def _get_sheet_id(spreadsheet_id: str, fallback_title: str, env_key: Optional[str] = None) -> Tuple[Optional[int], str]:
    svc = _sheets_service()
    meta = svc.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    title = (os.environ.get(env_key, "") if env_key else "").strip() or fallback_title
    sid = _sheet_id_by_title_fuzzy(meta, title)
    if sid is None and env_key:
        sid = _sheet_id_by_title_fuzzy(meta, fallback_title)
        if sid:
            title = fallback_title
    return sid, title

def _read_tab(spreadsheet_id: str, fallback_title: str, env_key: Optional[str] = None) -> List[List[str]]:
    svc = _sheets_service()
    sid, title = _get_sheet_id(spreadsheet_id, fallback_title, env_key)
    if sid is None:
        LOG.warning("Sheets: tab not found (wanted ~%r).", fallback_title)
        return []
    res = svc.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=f"{title}!A:ZZ"
    ).execute()
    return (res.get("values") or [])

def _delete_sheet_rows_by_voyage(spreadsheet_id: str, fallback_title: str, vslug: str, env_key: Optional[str] = None) -> int:
    svc = _sheets_service()
    meta = svc.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sid, title = _get_sheet_id(spreadsheet_id, fallback_title, env_key)
    if sid is None:
        return 0
    vals = svc.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=f"{title}!A:ZZ"
    ).execute().get("values", []) or []
    if not vals:
        return 0
    hdr = [h.strip().lower() for h in vals[0]]
    try:
        i_vslug = hdr.index("voyage_slug")
    except ValueError:
        LOG.warning("Sheets: column 'voyage_slug' not found in %r", title)
        return 0
    to_delete = [i for i, row in enumerate(vals[1:], start=1) if i_vslug < len(row) and row[i_vslug].strip() == vslug]
    if not to_delete:
        return 0
    requests = [{
        "deleteDimension": {
            "range": {"sheetId": sid, "dimension": "ROWS", "startIndex": r, "endIndex": r + 1}
        }
    } for r in sorted(to_delete, reverse=True)]
    svc.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute()
    return len(to_delete)

# ---------------- S3 helpers (best-effort, optional) ----------------

def _s3():
    return boto3.client("s3", region_name=AWS_REGION)

def _list_all_keys(bucket: str, prefix: str) -> List[str]:
    s3 = _s3()
    keys: List[str] = []
    token = None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for it in resp.get("Contents", []):
            key = it.get("Key")
            if key:
                keys.append(key)
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break
    return keys

def _copy_then_delete(bucket: str, key: str) -> Tuple[bool, bool]:
    """
    If S3_TRASH_BUCKET is set, copy there then delete from source bucket.
    Returns (archived, deleted).
    """
    s3 = _s3()
    archived = False
    deleted = False
    if S3_TRASH_BUCKET:
        try:
            s3.copy_object(
                Bucket=S3_TRASH_BUCKET,
                Key=f"trash/{bucket}/{key}",
                CopySource={"Bucket": bucket, "Key": key},
            )
            archived = True
        except Exception as e:
            LOG.warning("S3 archive failed for s3://%s/%s: %s", bucket, key, e)
    try:
        s3.delete_object(Bucket=bucket, Key=key)
        deleted = True
    except Exception as e:
        LOG.warning("S3 delete failed for s3://%s/%s: %s", bucket, key, e)
    return archived, deleted

def _is_protected(key: str) -> bool:
    # keep a hard guard: only touch the media/ subtree
    return not key.startswith("media/")

# NOTE: The ingest now names objects under:
#   media/<president>/<source>/<voyage>/<variant...>
# where "variant..." can be:
#   - legacy: <type>/<slug>.<ext>, <slug>_preview.jpg, <slug>_thumb.jpg
#   - extension folder: <ext>/<slug>.<ext>, <slug>_preview.jpg, <slug>_thumb.jpg
# We make S3 prune best-effort by filtering keys that contain "/<voyage_slug>/" (covers all variants).
def diff_and_prune_s3(voyage_slug: str, dry_run: bool = False) -> Dict[str, int]:
    stats = {"s3_deleted": 0, "s3_archived": 0}
    pres = president_from_voyage_slug(voyage_slug)
    if not pres or pres == "unknown-president":
        LOG.warning("S3 prune skipped: could not derive president from voyage_slug=%r", voyage_slug)
        return stats

    for bucket in (S3_PUBLIC_BUCKET, S3_PRIVATE_BUCKET):
        keys = _list_all_keys(bucket, f"media/{pres}/")
        keys = [k for k in keys if f"/{voyage_slug}/" in k]
        for key in keys:
            if _is_protected(key):
                continue
            if dry_run:
                LOG.info("[DRY_RUN] Would delete s3://%s/%s", bucket, key)
            else:
                archived, deleted = _copy_then_delete(bucket, key)
                stats["s3_archived"] += 1 if archived else 0
                stats["s3_deleted"] += 1 if deleted else 0
    return stats

# ---------------- Per-voyage Sheets prune ----------------

def diff_and_prune_sheets(bundle: Dict, dry_run: bool = False) -> Dict[str, int]:
    """
    For this voyage, delete join rows not present in desired bundle:
      - voyage_media (by (voyage_slug, media_slug))
      - voyage_passengers (by (voyage_slug, person_slug))
    """
    spreadsheet_id = os.environ.get("SPREADSHEET_ID", "").strip()
    if not spreadsheet_id:
        raise RuntimeError("SPREADSHEET_ID must be set for Sheets prune")

    v = bundle.get("voyage") or {}
    vslug = (v.get("voyage_slug") or "").strip()

    desired_media_slugs = { (m.get("slug") or "").strip() for m in (bundle.get("media") or []) if m.get("slug") }
    desired_person_slugs = { (p.get("slug") or "").strip() for p in (bundle.get("passengers") or []) if p.get("slug") }

    deleted_vm = deleted_vp = 0

    # voyage_media
    vm_rows = _read_tab(spreadsheet_id, DEFAULT_VOYAGE_MEDIA_TITLE, VOYAGE_MEDIA_TITLE_ENV)
    if vm_rows:
        hdr = [h.strip().lower() for h in vm_rows[0]]
        try:
            i_vslug = hdr.index("voyage_slug")
            i_mslug = hdr.index("media_slug")
        except ValueError:
            i_vslug = i_mslug = -1
        if i_vslug >= 0 and i_mslug >= 0:
            to_del: List[int] = []
            for i, row in enumerate(vm_rows[1:], start=1):
                if i_vslug < len(row) and row[i_vslug].strip() == vslug:
                    mslug = row[i_mslug].strip() if i_mslug < len(row) else ""
                    if mslug and mslug not in desired_media_slugs:
                        to_del.append(i)
            if to_del and not dry_run:
                svc = _sheets_service()
                sid, title = _get_sheet_id(spreadsheet_id, DEFAULT_VOYAGE_MEDIA_TITLE, VOYAGE_MEDIA_TITLE_ENV)
                requests = [{
                    "deleteDimension": {
                        "range": {"sheetId": sid, "dimension": "ROWS", "startIndex": r, "endIndex": r + 1}
                    }
                } for r in sorted(to_del, reverse=True)]
                svc.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute()
            deleted_vm = len(to_del)
            if dry_run and to_del:
                LOG.info("[DRY_RUN] Would delete %d rows from voyage_media for %s", len(to_del), vslug)

    # voyage_passengers
    vp_rows = _read_tab(spreadsheet_id, DEFAULT_VOYAGE_PASSENGERS_TITLE, VOYAGE_PASSENGERS_TITLE_ENV)
    if vp_rows:
        hdr = [h.strip().lower() for h in vp_rows[0]]
        try:
            i_vslug = hdr.index("voyage_slug")
            i_pslug = hdr.index("person_slug")
        except ValueError:
            i_vslug = i_pslug = -1
        if i_vslug >= 0 and i_pslug >= 0:
            to_del: List[int] = []
            for i, row in enumerate(vp_rows[1:], start=1):
                if i_vslug < len(row) and row[i_vslug].strip() == vslug:
                    pslug = row[i_pslug].strip() if i_pslug < len(row) else ""
                    if pslug and pslug not in desired_person_slugs:
                        to_del.append(i)
            if to_del and not dry_run:
                svc = _sheets_service()
                sid, title = _get_sheet_id(spreadsheet_id, DEFAULT_VOYAGE_PASSENGERS_TITLE, VOYAGE_PASSENGERS_TITLE_ENV)
                requests = [{
                    "deleteDimension": {
                        "range": {"sheetId": sid, "dimension": "ROWS", "startIndex": r, "endIndex": r + 1}
                    }
                } for r in sorted(to_del, reverse=True)]
                svc.spreadsheets().batchUpdate(spreadsheetId=spreadsheet_id, body={"requests": requests}).execute()
            deleted_vp = len(to_del)
            if dry_run and to_del:
                LOG.info("[DRY_RUN] Would delete %d rows from voyage_passengers for %s", len(to_del), vslug)

    return {"deleted_voyage_media": deleted_vm, "deleted_voyage_passengers": deleted_vp}

# ---------------- DB helpers/prune (per-voyage) ----------------

def _db_conn():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )

def _db_set_schema(cur):
    schema = os.environ.get("DB_SCHEMA", "sequoia")
    cur.execute(f"SET search_path = {schema}, public;")

def diff_and_prune_db(bundle: Dict, dry_run: bool = False, prune_masters: bool = False) -> Dict[str, int]:
    v = bundle.get("voyage") or {}
    vslug = (v.get("voyage_slug") or "").strip()
    desired_media_slugs = { (m.get("slug") or "").strip() for m in (bundle.get("media") or []) if m.get("slug") }
    desired_person_slugs = { (p.get("slug") or "").strip() for p in (bundle.get("passengers") or []) if p.get("slug") }

    stats = {"db_deleted_voyage_media": 0, "db_deleted_voyage_passengers": 0, "db_deleted_media": 0, "db_deleted_people": 0}

    conn = _db_conn()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            _db_set_schema(cur)
            # voyage_media
            cur.execute("SELECT media_slug FROM voyage_media WHERE voyage_slug=%s", (vslug,))
            existing_vm = { r[0] for r in cur.fetchall() }
            to_del_vm = sorted(existing_vm - desired_media_slugs)
            if to_del_vm:
                if dry_run:
                    for ms in to_del_vm:
                        LOG.info("[DRY_RUN] Would DELETE voyage_media: (%s, %s)", vslug, ms)
                else:
                    cur.execute("DELETE FROM voyage_media WHERE voyage_slug = %s AND media_slug = ANY(%s)", (vslug, to_del_vm))
                    stats["db_deleted_voyage_media"] = cur.rowcount

            # voyage_passengers
            cur.execute("SELECT person_slug FROM voyage_passengers WHERE voyage_slug=%s", (vslug,))
            existing_vp = { r[0] for r in cur.fetchall() }
            to_del_vp = sorted(existing_vp - desired_person_slugs)
            if to_del_vp:
                if dry_run:
                    for ps in to_del_vp:
                        LOG.info("[DRY_RUN] Would DELETE voyage_passengers: (%s, %s)", vslug, ps)
                else:
                    cur.execute("DELETE FROM voyage_passengers WHERE voyage_slug = %s AND person_slug = ANY(%s)", (vslug, to_del_vp))
                    stats["db_deleted_voyage_passengers"] = cur.rowcount

            # Optional master prune (orphan cleanup across all voyages)
            if prune_masters and not dry_run:
                cur.execute("""
                    WITH unused AS (
                      SELECT m.media_slug
                      FROM media m
                      LEFT JOIN voyage_media vm ON vm.media_slug = m.media_slug
                      WHERE vm.media_slug IS NULL
                    )
                    DELETE FROM media m
                    USING unused u
                    WHERE m.media_slug = u.media_slug;
                """)
                stats["db_deleted_media"] = cur.rowcount

                cur.execute("""
                    WITH unused AS (
                      SELECT p.person_slug
                      FROM people p
                      LEFT JOIN voyage_passengers vp ON vp.person_slug = p.person_slug
                      WHERE vp.person_slug IS NULL
                    )
                    DELETE FROM people p
                    USING unused u
                    WHERE p.person_slug = u.person_slug;
                """)
                stats["db_deleted_people"] = cur.rowcount

        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    except Exception as e:
        conn.rollback()
        LOG.error("DB prune failed for %s: %s", vslug, e)
        raise
    finally:
        conn.close()

    return stats

# ---------------- Global prune: voyages removed from Doc ----------------

def _read_all_voyage_slugs_from_sheet(spreadsheet_id: str) -> Set[str]:
    rows = _read_tab(spreadsheet_id, DEFAULT_VOYAGES_TITLE, VOYAGES_TITLE_ENV)
    if not rows:
        return set()
    hdr = [h.strip().lower() for h in rows[0]]
    if "voyage_slug" not in hdr:
        return set()
    i = hdr.index("voyage_slug")
    return { (r[i].strip()) for r in rows[1:] if i < len(r) and r[i].strip() }

def prune_voyages_missing_from_doc_with_set(
    desired_voyage_slugs: Set[str],
    dry_run: bool = False,
    prune_db: bool = True,
    prune_sheets: bool = True,
    prune_s3: bool = False,   # keep S3 additive globally unless explicitly requested
) -> dict:
    """
    Remove voyages that exist in Sheets/DB/S3 but are NOT present in the Doc.
    - Sheets: delete rows from voyages, voyage_media, voyage_passengers for those slugs
    - DB:     delete rows from voyages, voyage_media, voyage_passengers
    - S3:     delete all keys under media/<president>/**/<voyage_slug>/** (best-effort)
    """
    stats = {
        "missing_count": 0,
        "sheets_deleted_rows": 0,
        "db_deleted_vm": 0,
        "db_deleted_vp": 0,
        "db_deleted_voyages": 0,
        "s3_deleted": 0,
        "s3_archived": 0,
    }

    spreadsheet_id = os.environ.get("SPREADSHEET_ID", "").strip()

    # If Sheets operations are disabled, only do DB/S3 pruning
    if prune_sheets:
        if not spreadsheet_id:
            raise RuntimeError("SPREADSHEET_ID must be set for Sheets prune")
        existing = _read_all_voyage_slugs_from_sheet(spreadsheet_id)
        missing = sorted(existing - set(desired_voyage_slugs))
        stats["missing_count"] = len(missing)
        if not missing:
            return stats
    else:
        # When Sheets disabled, only get missing voyages from DB
        missing = []
        if prune_db:
            from voyage_ingest import db_updater
            all_db_slugs = db_updater.get_all_voyage_slugs_from_db()
            missing = sorted(set(all_db_slugs) - set(desired_voyage_slugs))
            stats["missing_count"] = len(missing)
        if not missing:
            return stats

    # ---- Sheets prune
    if prune_sheets and spreadsheet_id:
        for vs in missing:
            if dry_run:
                LOG.info("[DRY_RUN] Would delete Sheets rows for missing voyage: %s", vs)
            else:
                stats["sheets_deleted_rows"] += _delete_sheet_rows_by_voyage(
                    spreadsheet_id, DEFAULT_VOYAGE_MEDIA_TITLE, vs, VOYAGE_MEDIA_TITLE_ENV
                )
                stats["sheets_deleted_rows"] += _delete_sheet_rows_by_voyage(
                    spreadsheet_id, DEFAULT_VOYAGE_PASSENGERS_TITLE, vs, VOYAGE_PASSENGERS_TITLE_ENV
                )
                stats["sheets_deleted_rows"] += _delete_sheet_rows_by_voyage(
                    spreadsheet_id, DEFAULT_VOYAGES_TITLE, vs, VOYAGES_TITLE_ENV
                )

    # ---- DB prune
    if prune_db:
        conn = _db_conn()
        try:
            with conn:
                with conn.cursor() as cur:
                    _db_set_schema(cur)
                    if dry_run:
                        for vs in missing:
                            LOG.info("[DRY_RUN] Would DELETE DB entries for voyage: %s", vs)
                    else:
                        cur.execute("DELETE FROM voyage_media WHERE voyage_slug = ANY(%s)", (missing,))
                        stats["db_deleted_vm"] = cur.rowcount
                        cur.execute("DELETE FROM voyage_passengers WHERE voyage_slug = ANY(%s)", (missing,))
                        stats["db_deleted_vp"] = cur.rowcount
                        cur.execute("DELETE FROM voyages WHERE voyage_slug = ANY(%s)", (missing,))
                        stats["db_deleted_voyages"] = cur.rowcount
        finally:
            conn.close()

    # ---- S3 prune (entire voyage across all sources under the president; best-effort)
    if prune_s3:
        for vslug in missing:
            pres = president_from_voyage_slug(vslug)
            for bucket in (S3_PUBLIC_BUCKET, S3_PRIVATE_BUCKET):
                keys = _list_all_keys(bucket, f"media/{pres}/")
                keys = [k for k in keys if f"/{vslug}/" in k]
                for key in keys:
                    if _is_protected(key):
                        continue
                    if dry_run:
                        LOG.info("[DRY_RUN] Would delete s3://%s/%s", bucket, key)
                    else:
                        archived, deleted = _copy_then_delete(bucket, key)
                        stats["s3_archived"] += 1 if archived else 0
                        stats["s3_deleted"] += 1 if deleted else 0

    return stats
