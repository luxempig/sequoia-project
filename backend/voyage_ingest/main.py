# ================================================================
# voyage-ingest/voyage_ingest/main.py
# ================================================================
"""
Main entry for Sequoia multi-voyage ingest.

Environment (required):
  DOC_ID                 : Google Doc ID containing the ingestable markdown
  SPREADSHEET_ID        : Target Google Sheet (voyages, media, passengers, joins, presidents)
  GOOGLE_APPLICATION_CREDENTIALS : Path to service account JSON

Behavior:
- Parse the Doc into (presidents, bundles).
- Reset the presidents tab (Sheets) and table (DB) from the Doc's ## President headers.
- For each voyage bundle:
    * validate
    * process media → S3 (additive; rename/move if same link seen with new slugged path)
    * upsert to Sheets
    * prune per-voyage dangling joins in Sheets/DB to exactly match the Doc
    * upsert to DB
- Global reconcile: remove voyages missing from the Doc (Sheets/DB only; S3 untouched here).
- Append ingest_log rows.

Notes:
- No need to provide voyage_slug in the Doc; parser auto-generates it.
- The last seen ## President header applies to all following voyages until the next ## President.
"""

import os
import logging
import argparse
import json
from datetime import datetime
from dotenv import load_dotenv

from voyage_ingest import (
    parser,
    validator,
    drive_sync,
    sheets_updater,
    reconciler,
    db_updater,
)

LOG = logging.getLogger("voyage_ingest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def _as_bool(s: str, default=False) -> bool:
    if s is None:
        return default
    return s.strip().lower() in {"1", "true", "yes", "y", "on"}


def parse_json_file(json_path):
    """Parse JSON file in the voyage translation format."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Extract data from the format: {"roosevelt-franklin": {"term_start": ..., "voyages": [...], ...}}
    presidents = []
    bundles = []

    # Map president keys to full names and parties
    # Post-Carter presidents are not actual owners - their voyages should be assigned to "post-presidential"
    president_info_map = {
        "truman-harry": {"full_name": "Harry S. Truman", "party": "Democratic"},
        "roosevelt-franklin": {"full_name": "Franklin D. Roosevelt", "party": "Democratic"},
        "eisenhower-dwight": {"full_name": "Dwight D. Eisenhower", "party": "Republican"},
        "kennedy-john": {"full_name": "John F. Kennedy", "party": "Democratic"},
        "johnson-lyndon": {"full_name": "Lyndon B. Johnson", "party": "Democratic"},
        "nixon-richard": {"full_name": "Richard Nixon", "party": "Republican"},
        "ford-gerald": {"full_name": "Gerald Ford", "party": "Republican"},
        "carter-jimmy": {"full_name": "Jimmy Carter", "party": "Democratic"},
        # Reagan and later are NOT owners - map to post-presidential
        "reagan-ronald": {"is_post_presidential": True},
        "bush-george-w": {"is_post_presidential": True},
        "obama-barack": {"is_post_presidential": True},
    }

    # Track if we've added the post-presidential owner
    post_presidential_added = False

    for president_key, pres_data in data.items():
        if not isinstance(pres_data, dict):
            continue

        # Get president details from the map or extract from key
        pres_info = president_info_map.get(president_key, {})

        # Check if this is a post-presidential era voyage (Reagan onwards)
        is_post_presidential = pres_info.get("is_post_presidential", False)

        if is_post_presidential:
            # Add the post-presidential owner entry once
            if not post_presidential_added:
                president_info = {
                    "president_slug": "post-presidential",
                    "full_name": "Post-Presidential",
                    "term_start": "January 20, 1981",
                    "term_end": "December 31, 9999",  # Far future date for ongoing ownership
                    "party": "Private Owners"
                }
                presidents.append(president_info)
                post_presidential_added = True
            # Use post-presidential slug for these voyages
            actual_president_slug = "post-presidential"
        else:
            # Extract full name from key if not in map (lastname-firstname -> Firstname Lastname)
            if not pres_info.get("full_name"):
                parts = president_key.split("-")
                if len(parts) >= 2:
                    full_name = f"{parts[1].title()} {parts[0].title()}"
                    if len(parts) > 2:
                        full_name = f"{' '.join(p.title() for p in parts[1:])} {parts[0].title()}"
                else:
                    full_name = president_key.replace("-", " ").title()
                pres_info["full_name"] = full_name

            # Create president info from the JSON format
            president_info = {
                "president_slug": president_key,
                "full_name": pres_info.get("full_name", president_key.replace("-", " ").title()),
                "term_start": pres_data.get("term_start"),
                "term_end": pres_data.get("term_end"),
                "party": pres_info.get("party", "Unknown")
            }
            presidents.append(president_info)
            actual_president_slug = president_key

        # Extract voyages with embedded passengers and media
        voyages = pres_data.get("voyages", [])

        for voyage in voyages:
            # Transform the voyage data to match expected format
            transformed_voyage = {
                "voyage_slug": voyage.get("voyage", ""),
                "president_slug": actual_president_slug,  # Use actual owner (post-presidential for Reagan+)
                "start_date": voyage.get("start_date"),
                "end_date": voyage.get("end_date"),
                "start_time": voyage.get("start_time"),
                "end_time": voyage.get("end_time"),
                "origin": voyage.get("origin"),
                "destination": voyage.get("destination"),
                "notes": voyage.get("notes", []),
                "tags": voyage.get("tags", []),
                "missing_info": voyage.get("missing_info", {})
            }

            # Transform passengers to expected format
            passengers = []
            for p in voyage.get("passengers", []):
                passenger = {
                    "person_slug": p.get("name", ""),
                    "full_name": p.get("full_name", ""),
                    "title": p.get("title", ""),
                    "bio_url": p.get("bio", "")
                }
                passengers.append(passenger)

            # Transform media to expected format
            media = []
            for m in voyage.get("media", []):
                media_item = {
                    # Don't set slug yet - let slugger.generate_media_slugs() create proper ones
                    "title": m.get("source", ""),
                    "google_drive_link": m.get("link", ""),  # drive_sync expects "google_drive_link"
                    "url": m.get("link", ""),  # also keep for potential other uses
                    "media_type": m.get("type", ""),
                    "platform": m.get("platform", ""),
                    "date": m.get("date", ""),
                    "credit": m.get("source", "")  # use source as credit for S3 path organization
                }
                media.append(media_item)

            # Generate proper media slugs for S3 organization
            from voyage_ingest.slugger import generate_media_slugs
            generate_media_slugs(media, transformed_voyage["voyage_slug"])

            # Each voyage bundle contains the voyage data plus related passengers and media
            bundle = {
                "president": president_info,
                "voyage": transformed_voyage,
                "passengers": passengers,
                "media": media
            }
            bundles.append(bundle)

    return presidents, bundles


def _classify_status(validation_errors, media_warnings):
    if validation_errors:
        return "ERROR"
    if media_warnings:
        return "WITH_WARNINGS"
    return "OK"


def main():
    # Parse command line arguments
    parser_args = argparse.ArgumentParser(description="Voyage Ingest Pipeline")
    parser_args.add_argument("--source", choices=["doc", "json"], default="doc", help="Input source type")
    parser_args.add_argument("--file", help="JSON file path (when source=json)")
    args = parser_args.parse_args()

    load_dotenv()

    doc_id = os.environ.get("DOC_ID", "").strip()
    spreadsheet_id = os.environ.get("SPREADSHEET_ID", "").strip()  # No longer required
    dry_run = _as_bool(os.environ.get("DRY_RUN"), default=False)

    # Handle different input sources
    if args.source == "json":
        if not args.file:
            LOG.error("--file argument required when --source=json")
            return
        if not os.path.exists(args.file):
            LOG.error(f"JSON file not found: {args.file}")
            return
        LOG.info("=== Voyage Ingest (JSON, Sheets disabled) ===  DRY_RUN=%s  FILE=%s", dry_run, args.file)

        # Parse JSON file into presidents + voyage bundles
        presidents, bundles = parse_json_file(args.file)
        source_id = args.file
    else:
        # Original Google Doc parsing
        if not doc_id or not spreadsheet_id:
            LOG.error("Missing required env vars: DOC_ID and/or SPREADSHEET_ID")
            return
        LOG.info("=== Voyage Ingest (Doc) ===  DRY_RUN=%s  DOC_ID=%s  SHEET=%s", dry_run, doc_id, spreadsheet_id)

        # Parse the Google Doc into presidents + voyage bundles
        presidents, bundles = parser.parse_doc_multi(doc_id)
        source_id = doc_id
    if not bundles:
        LOG.error("No voyages found in the document.")
        return

    # ---------------- Reset presidents (DB only, skipping Sheets) ----------------
    LOG.info("Skipping Google Sheets operations (sheets disabled)")
    try:
        db_updater.reset_presidents_table_from_list(presidents)
    except Exception as e:
        LOG.error("Failed to reset presidents table: %s", e)
        return

    # ---------------- Global exactness: remove voyages missing from Doc (Sheets/DB only) ----------------
    ts = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    log_rows = []
    total_errors = 0

    desired_slugs = {
        (b.get("voyage") or {}).get("voyage_slug", "").strip()
        for b in bundles
        if (b.get("voyage") or {}).get("voyage_slug")
    }
    desired_slugs = {s for s in desired_slugs if s}

    global_prune_stats = reconciler.prune_voyages_missing_from_doc_with_set(
        desired_voyage_slugs=desired_slugs,
        dry_run=dry_run,
        prune_db=True,
        prune_sheets=False,  # Sheets disabled
        prune_s3=True,  # Delete S3 files for voyages removed from JSON (exact mirror)
    )
    LOG.info("Global reconcile of missing voyages (DB only): %s", global_prune_stats)

    # ---------------- Per-voyage processing ----------------
    for idx, bundle in enumerate(bundles, start=1):
        v = bundle.get("voyage") or {}
        vslug = (v.get("voyage_slug") or "").strip()
        LOG.info("--- Processing voyage %d/%d: %s ---", idx, len(bundles), vslug or "<no-slug>")

        # 1) Validate structured bundle
        errs = validator.validate_bundle(bundle)
        if errs:
            total_errors += len(errs)
            for e in errs:
                LOG.error(" - %s", e)
            log_rows.append([
                ts, doc_id, vslug or f"[bundle#{idx}]",
                "ERROR", str(len(errs)), "0",
                str(len(bundle.get("media", []) or [])),
                "0", "0",
                "exact", "TRUE" if dry_run else "FALSE",
                "0", "0", "0", "0", "0", "0", "0", "0",
                (errs[0] if errs else "")[:250],
            ])
            continue

        # 2) Media → S3 (additive; move on same-link rename if needed)
        # Process synchronously (async_thumbnails=False) to generate thumbnails immediately
        s3_links, media_warnings = drive_sync.process_all_media(
            bundle.get("media", []), vslug, async_thumbnails=False
        )
        for mw in media_warnings:
            LOG.warning("Media issue: %s", mw)

        # 3) Skipping Sheets upsert (sheets disabled)
        # sheets_updater.update_all(spreadsheet_id, bundle, s3_links)

        # 4) Per-voyage prune of joins (DB only, Sheets disabled)
        sheets_deleted_vm = sheets_deleted_vp = 0
        db_deleted_vm = db_deleted_vp = db_deleted_media = db_deleted_people = 0

        # Skipping Sheets prune (sheets disabled)
        # reconciler.diff_and_prune_sheets(bundle, dry_run=dry_run)

        try:
            db_stats = reconciler.diff_and_prune_db(bundle, dry_run=dry_run, prune_masters=not dry_run)
            db_deleted_vm = db_stats.get("db_deleted_voyage_media", 0)
            db_deleted_vp = db_stats.get("db_deleted_voyage_passengers", 0)
            db_deleted_media = db_stats.get("db_deleted_media", 0)
            db_deleted_people = db_stats.get("db_deleted_people", 0)
        except Exception as e:
            LOG.warning("DB prune failed for %s: %s", vslug, e)

        # Note: Per-voyage S3 pruning not implemented yet - would need media-slug-specific deletion
        # Currently only global voyage deletion triggers S3 cleanup (see global_prune_stats above)

        # 5) Upsert DB (idempotent)
        try:
            db_updater.upsert_all(bundle, s3_links)
        except Exception as e:
            LOG.warning("DB upsert failed for %s: %s", vslug, e)

        # 6) Ingest log row
        status = _classify_status(errs, media_warnings)
        media_declared = len(bundle.get("media", []) or [])
        media_uploaded = sum(1 for _, (orig, _pub) in s3_links.items() if orig)
        thumbs_uploaded = sum(1 for _, (_orig, pub) in s3_links.items() if pub)
        note = (media_warnings[0] if media_warnings else "OK")

        log_rows.append([
            ts, source_id, vslug or f"[bundle#{idx}]",
            status,
            "0", str(len(media_warnings)),
            str(media_declared),
            str(media_uploaded),
            str(thumbs_uploaded),
            "exact", "TRUE" if dry_run else "FALSE",
            "0", "0",
            str(sheets_deleted_vm), str(sheets_deleted_vp),
            str(db_deleted_vm), str(db_deleted_vp),
            str(db_deleted_media), str(db_deleted_people),
            (note or "")[:250],
        ])

    # 7) Add a GLOBAL row summarizing global reconcile (Sheets/DB)
    if global_prune_stats is not None:
        log_rows.append([
            ts, source_id, "[GLOBAL]",
            "OK",
            "0", "0", "0", "0", "0",
            "exact", "TRUE" if dry_run else "FALSE",
            "0", "0",
            str(global_prune_stats.get("sheets_deleted_rows", 0)),
            "0",
            str(global_prune_stats.get("db_deleted_vm", 0)),
            str(global_prune_stats.get("db_deleted_vp", 0)),
            str(global_prune_stats.get("db_deleted_voyages", 0)),
            "0",
            f"missing_count={global_prune_stats.get('missing_count', 0)}",
        ])

    # 8) Skipping ingest_log write to Sheets (sheets disabled)
    if log_rows:
        LOG.info("Skipped writing %d log row(s) to Sheets ingest_log (sheets disabled).", len(log_rows))

    if total_errors:
        LOG.warning("Completed with %d validation error(s). See logs above.", total_errors)
    else:
        LOG.info("Completed successfully: %d voyage(s) processed.", len(bundles))


if __name__ == "__main__":
    main()
