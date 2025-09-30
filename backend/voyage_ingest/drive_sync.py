from __future__ import annotations

import io
import os
import re
import mimetypes
import logging
from typing import Dict, List, Tuple, Optional

import boto3
from PIL import Image
import requests

try:
    import fitz  # PyMuPDF for PDF thumbnails
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import ffmpeg  # ffmpeg-python for video thumbnails
    HAS_FFMPEG = True
except ImportError:
    HAS_FFMPEG = False

try:
    import librosa  # for audio waveform generation
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    HAS_AUDIO_LIBS = True
except ImportError:
    HAS_AUDIO_LIBS = False

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from voyage_ingest.slugger import normalize_source, president_from_voyage_slug

LOG = logging.getLogger("voyage_ingest.drive_sync")

AWS_REGION        = os.environ.get("AWS_REGION", "us-east-1")
S3_PRIVATE_BUCKET = os.environ.get("S3_PRIVATE_BUCKET", "sequoia-canonical")
S3_PUBLIC_BUCKET  = os.environ.get("S3_PUBLIC_BUCKET",  "sequoia-public")

DRIVE_SCOPES  = ["https://www.googleapis.com/auth/drive.readonly"]

DROPBOX_ACCESS_TOKEN = os.environ.get("DROPBOX_ACCESS_TOKEN", "").strip()
DROPBOX_TIMEOUT = int(os.environ.get("DROPBOX_TIMEOUT", "60"))

# ------- Google services -------
def _drive_service():
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if not creds_path or not os.path.exists(creds_path):
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS not set or invalid path")
    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=DRIVE_SCOPES)
    return build("drive", "v3", credentials=creds)

# ------- Link parsing & downloads -------
def _parse_drive_file_id(url: str) -> Optional[str]:
    m = re.search(r"/file/d/([A-Za-z0-9_\-]+)/", url or "")
    return m.group(1) if m else None

def _download_drive_binary(file_id: str) -> Tuple[bytes, str, str]:
    svc = _drive_service()
    meta = svc.files().get(fileId=file_id, fields="id,name,mimeType").execute()
    mime = meta.get("mimeType") or "application/octet-stream"
    name = meta.get("name") or "file"
    req = svc.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, req)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    return buf.getvalue(), mime, name

def _download_dropbox_binary(shared_url: str) -> Tuple[bytes, str, Optional[str]]:
    if DROPBOX_ACCESS_TOKEN:
        api = "https://content.dropboxapi.com/2/sharing/get_shared_link_file"
        headers = {
            "Authorization": f"Bearer {DROPBOX_ACCESS_TOKEN}",
            "Dropbox-API-Arg": f'{{"url":"{shared_url}"}}',
        }
        r = requests.post(api, headers=headers, timeout=DROPBOX_TIMEOUT)
        r.raise_for_status()
        ctype = r.headers.get("Content-Type","application/octet-stream")
        dispo = r.headers.get("Content-Disposition","")
        ext = None
        m = re.search(r'filename\*?=.*?\.([A-Za-z0-9]{1,8})', dispo)
        if m: ext = m.group(1).lower()
        return r.content, ctype, ext
    else:
        dl = shared_url
        if "dl=0" in dl: dl = dl.replace("dl=0","dl=1")
        elif "dl=1" in dl: pass
        elif "?" in dl: dl = dl + "&dl=1"
        else: dl = dl + "?dl=1"
        r = requests.get(dl, timeout=DROPBOX_TIMEOUT)
        r.raise_for_status()
        ctype = r.headers.get("Content-Type","application/octet-stream")
        dispo = r.headers.get("Content-Disposition","")
        ext = None
        m = re.search(r'filename\*?=.*?\.([A-Za-z0-9]{1,8})', dispo)
        if m: ext = m.group(1).lower()
        return r.content, ctype, ext

# ------- Media type/ext detection -------
IMAGE_EXTS = {"jpg","jpeg","png","webp","gif","tiff"}
VIDEO_EXTS = {"mp4","mov","avi","mkv"}
AUDIO_EXTS = {"mp3","wav","aac","ogg"}
PDF_EXTS   = {"pdf"}

def _ext_from_name_or_mime(name: str, mime: str) -> str:
    ext = os.path.splitext(name or "")[1].lstrip(".").lower()
    if not ext:
        ext_guess = (mimetypes.guess_extension(mime or "") or "").lstrip(".").lower()
        if ext_guess == "jpe": ext_guess = "jpg"
        ext = ext_guess
    return ext or "bin"

def detect_media_type_from_ext(ext: str) -> str:
    e = (ext or "").lower()
    if e in IMAGE_EXTS: return "image"
    if e in VIDEO_EXTS: return "video"
    if e in AUDIO_EXTS: return "audio"
    if e in PDF_EXTS:   return "pdf"
    return "other"

# ------- S3 -------
def _s3(): return boto3.client("s3", region_name=AWS_REGION)
def _s3_url(bucket: str, key: str) -> str: return f"s3://{bucket}/{key}"
def _public_http_url(bucket: str, key: str) -> str: return f"https://{bucket}.s3.amazonaws.com/{key}"

def _s3_key_for_original(vslug: str, mslug: str, ext: str, credit: str) -> str:
    pres_slug = president_from_voyage_slug(vslug)
    return f"media/{pres_slug}/{vslug}/{mslug}.{ext}"

def _s3_key_for_derivative(vslug: str, mslug: str, ext: str, credit: str, kind: str) -> str:
    pres_slug = president_from_voyage_slug(vslug)
    return f"media/{pres_slug}/{vslug}/{mslug}_{kind}.jpg"

def _upload_bytes(bucket: str, key: str, data: bytes, content_type: Optional[str] = None) -> None:
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    # Set Content-Disposition to inline so files display in browser instead of downloading
    extra["ContentDisposition"] = "inline"
    _s3().put_object(Bucket=bucket, Key=key, Body=data, **extra)

def _copy_object(src_bucket: str, src_key: str, dst_bucket: str, dst_key: str, content_type: Optional[str] = None) -> None:
    extra = {"CopySource": {"Bucket": src_bucket, "Key": src_key}, "Bucket": dst_bucket, "Key": dst_key}
    extra["MetadataDirective"] = "REPLACE"
    if content_type:
        extra["ContentType"] = content_type
    # Set Content-Disposition to inline so files display in browser
    extra["ContentDisposition"] = "inline"
    _s3().copy_object(**extra)

def _delete_object(bucket: str, key: str) -> None:
    _s3().delete_object(Bucket=bucket, Key=key)

def _make_video_thumbnail(video_bytes: bytes, thumb_size=320) -> Optional[bytes]:
    """Create a thumbnail from a video file using ffmpeg."""
    if not HAS_FFMPEG:
        return None
    
    try:
        # Write video bytes to temporary file-like object
        input_buffer = io.BytesIO(video_bytes)
        
        # Use ffmpeg to extract frame at 1 second (or 10% into video)
        process = (
            ffmpeg
            .input('pipe:0')
            .filter('scale', thumb_size, thumb_size, force_original_aspect_ratio='decrease')
            .filter('pad', thumb_size, thumb_size, -1, -1, color='black')
            .output('pipe:1', format='png', vframes=1, ss=1)  # Extract frame at 1 second
            .overwrite_output()
            .run_async(pipe_stdin=True, pipe_stdout=True, pipe_stderr=True, quiet=True)
        )
        
        stdout, stderr = process.communicate(input=video_bytes)
        
        if process.returncode != 0:
            LOG.warning("ffmpeg failed: %s", stderr.decode())
            return None
            
        # Convert PNG to JPEG
        img = Image.open(io.BytesIO(stdout))
        buf = io.BytesIO()
        img.convert('RGB').save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue()
        
    except Exception as e:
        LOG.warning("Failed to create video thumbnail: %s", e)
        return None


def _make_audio_waveform(audio_bytes: bytes, thumb_size=320) -> Optional[bytes]:
    """Create a waveform visualization thumbnail for audio files."""
    if not HAS_AUDIO_LIBS:
        return None
    
    try:
        # Write audio to temporary buffer
        audio_buffer = io.BytesIO(audio_bytes)
        
        # Load audio with librosa (it can handle various formats)
        y, sr = librosa.load(audio_buffer, sr=22050, duration=30)  # Load first 30 seconds
        
        # Create waveform plot
        plt.figure(figsize=(thumb_size/100, thumb_size/100), dpi=100)
        plt.plot(y, color='#1f77b4', linewidth=0.5)
        plt.fill_between(range(len(y)), y, alpha=0.3, color='#1f77b4')
        plt.axis('off')
        plt.tight_layout(pad=0)
        
        # Save to bytes
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0, facecolor='black')
        plt.close()
        
        # Convert to JPEG
        img = Image.open(buf)
        jpeg_buf = io.BytesIO()
        img.convert('RGB').save(jpeg_buf, format="JPEG", quality=85, optimize=True)
        return jpeg_buf.getvalue()
        
    except Exception as e:
        LOG.warning("Failed to create audio waveform: %s", e)
        return None


def _convert_office_to_pdf_and_thumbnail(office_bytes: bytes, mime_type: str, thumb_size=320) -> Optional[bytes]:
    """Convert office document to PDF, then create thumbnail."""
    # This is a placeholder - you'd need LibreOffice headless or similar
    # For now, just return None to indicate no thumbnail possible
    LOG.info("Office document thumbnail not implemented yet (would need LibreOffice headless)")
    return None


def _make_pdf_thumbnail(pdf_bytes: bytes, thumb_size=320) -> Optional[bytes]:
    """Create a thumbnail from the first page of a PDF."""
    if not HAS_PYMUPDF:
        return None
    
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            return None
        
        # Get first page
        page = doc[0]
        
        # Render as image (at 150 DPI for good quality)
        mat = fitz.Matrix(150/72, 150/72)  # 150 DPI scaling
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("ppm")
        doc.close()
        
        # Convert to PIL Image and create thumbnail
        img = Image.open(io.BytesIO(img_data))
        img.thumbnail((thumb_size, thumb_size), Image.LANCZOS)
        
        # Convert to JPEG
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue()
        
    except Exception as e:
        LOG.warning("Failed to create PDF thumbnail: %s", e)
        return None


def _make_image_derivatives(img_bytes: bytes, max_long_edge_preview=1600, thumb_size=320) -> Tuple[bytes, bytes]:
    with Image.open(io.BytesIO(img_bytes)) as im:
        im = im.convert("RGB")
        w, h = im.size
        if w >= h:
            new_w = min(max_long_edge_preview, w)
            new_h = int(h * (new_w / w))
        else:
            new_h = min(max_long_edge_preview, h)
            new_w = int(w * (new_h / h))
        preview = im.resize((new_w, new_h), Image.LANCZOS)
        buf_prev = io.BytesIO()
        preview.save(buf_prev, format="JPEG", quality=88, optimize=True)
        im_copy = im.copy()
        im_copy.thumbnail((thumb_size, thumb_size), Image.LANCZOS)
        buf_th = io.BytesIO()
        im_copy.save(buf_th, format="JPEG", quality=85, optimize=True)
        return buf_prev.getvalue(), buf_th.getvalue()

# ------- Public API -------
def process_all_media(media_items: List[Dict], voyage_slug: str, async_thumbnails: bool = True) -> Tuple[Dict[str, Tuple[Optional[str], Optional[str]]], List[str]]:
    """
    Download each media by link, upload original to S3:
      media/{pres}/{source}/{voyage}/{ext}/{slug}.{ext}

    If async_thumbnails=True (default), only uploads originals and queues derivative generation.
    If async_thumbnails=False, creates derivatives synchronously (legacy behavior).

    Returns:
      s3_links: { media_slug: (s3_private_url, public_preview_url|None) }
      warnings: [ ... ]
    """
    s3_links: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
    warnings: List[str] = []
    async_media_batch = []  # For batch async processing

    for i, m in enumerate(media_items, start=1):
        mslug = (m.get("slug") or "").strip()
        credit = (m.get("credit") or "").strip()
        link = (m.get("google_drive_link") or "").strip()
        title = (m.get("title") or "").strip()

        if not mslug or not link:
            warnings.append(f"media #{i} missing slug or link; skipping")
            s3_links[mslug or f"missing-{i}"] = (None, None)
            continue

        blob = None
        mime = None
        fname = ""

        # Download media from source
        if "/file/d/" in link:  # Google Drive
            file_id = _parse_drive_file_id(link)
            if not file_id:
                warnings.append(f"{mslug}: invalid Google Drive link")
                s3_links[mslug] = (None, None)
                continue
            try:
                blob, mime, fname = _download_drive_binary(file_id)
            except Exception as e:
                warnings.append(f"{mslug}: failed to download from Drive: {e}")
                s3_links[mslug] = (None, None)
                continue
        elif "dropbox.com" in link.lower():
            try:
                blob, mime, ext_hint = _download_dropbox_binary(link)
                fname = f"file.{ext_hint or 'bin'}"
            except Exception as e:
                warnings.append(f"{mslug}: failed to download from Dropbox: {e}")
                s3_links[mslug] = (None, None)
                continue
        else:
            warnings.append(f"{mslug}: unsupported media link (not Drive/Dropbox)")
            s3_links[mslug] = (None, None)
            continue

        # Extension & type
        ext = _ext_from_name_or_mime(fname, mime)
        mtype = detect_media_type_from_ext(ext)

        # Upload original to private bucket
        orig_key = _s3_key_for_original(voyage_slug, mslug, ext, credit)
        try:
            _upload_bytes(S3_PRIVATE_BUCKET, orig_key, blob, content_type=mime)
            s3_private = _s3_url(S3_PRIVATE_BUCKET, orig_key)
            LOG.info("Uploaded original media %s -> %s", mslug, orig_key)
        except Exception as e:
            warnings.append(f"{mslug}: failed to upload original to s3://{S3_PRIVATE_BUCKET}/{orig_key}: {e}")
            s3_links[mslug] = (None, None)
            continue

        # Handle derivative generation
        public_url = None

        if async_thumbnails:
            # Queue for async processing - don't block the ingest pipeline
            if mtype in ["image", "pdf", "video", "audio"]:
                async_media_batch.append({
                    "media_slug": mslug,
                    "ext": ext,
                    "credit": credit,
                    "s3_original_key": orig_key,
                    "media_type": mtype
                })
                LOG.info("Queued %s for async derivative generation", mslug)
            else:
                LOG.info("Media type '%s' not supported for derivative generation: %s", mtype, mslug)
        else:
            # Synchronous processing (legacy behavior)
            if mtype == "image" and blob:
                try:
                    prev, th = _make_image_derivatives(blob)
                    prev_key = _s3_key_for_derivative(voyage_slug, mslug, ext, credit, "preview")
                    th_key   = _s3_key_for_derivative(voyage_slug, mslug, ext, credit, "thumb")
                    _upload_bytes(S3_PUBLIC_BUCKET, prev_key, prev, content_type="image/jpeg")
                    _upload_bytes(S3_PUBLIC_BUCKET, th_key,   th,   content_type="image/jpeg")
                    public_url = _public_http_url(S3_PUBLIC_BUCKET, prev_key)
                except Exception as e:
                    warnings.append(f"{mslug}: failed to create/upload image derivatives: {e}")
            elif mtype == "pdf" and blob:
                try:
                    th = _make_pdf_thumbnail(blob)
                    if th:
                        th_key = _s3_key_for_derivative(voyage_slug, mslug, ext, credit, "thumb")
                        _upload_bytes(S3_PUBLIC_BUCKET, th_key, th, content_type="image/jpeg")
                        public_url = _public_http_url(S3_PUBLIC_BUCKET, th_key)
                    else:
                        warnings.append(f"{mslug}: could not generate PDF thumbnail (PyMuPDF not available or PDF issue)")
                except Exception as e:
                    warnings.append(f"{mslug}: failed to create/upload PDF thumbnail: {e}")
            elif mtype == "video" and blob:
                try:
                    th = _make_video_thumbnail(blob)
                    if th:
                        th_key = _s3_key_for_derivative(voyage_slug, mslug, ext, credit, "thumb")
                        _upload_bytes(S3_PUBLIC_BUCKET, th_key, th, content_type="image/jpeg")
                        public_url = _public_http_url(S3_PUBLIC_BUCKET, th_key)
                    else:
                        warnings.append(f"{mslug}: could not generate video thumbnail (ffmpeg not available or video issue)")
                except Exception as e:
                    warnings.append(f"{mslug}: failed to create/upload video thumbnail: {e}")
            elif mtype == "audio" and blob:
                try:
                    th = _make_audio_waveform(blob)
                    if th:
                        th_key = _s3_key_for_derivative(voyage_slug, mslug, ext, credit, "thumb")
                        _upload_bytes(S3_PUBLIC_BUCKET, th_key, th, content_type="image/jpeg")
                        public_url = _public_http_url(S3_PUBLIC_BUCKET, th_key)
                    else:
                        warnings.append(f"{mslug}: could not generate audio waveform (audio libraries not available)")
                except Exception as e:
                    warnings.append(f"{mslug}: failed to create/upload audio waveform: {e}")
            elif mtype == "other" and blob and mime:
                # Try to handle office documents by converting to PDF first, then thumbnail
                if any(office_type in mime.lower() for office_type in ['word', 'excel', 'powerpoint', 'presentation', 'spreadsheet', 'document']):
                    try:
                        th = _convert_office_to_pdf_and_thumbnail(blob, mime)
                        if th:
                            th_key = _s3_key_for_derivative(voyage_slug, mslug, ext, credit, "thumb")
                            _upload_bytes(S3_PUBLIC_BUCKET, th_key, th, content_type="image/jpeg")
                            public_url = _public_http_url(S3_PUBLIC_BUCKET, th_key)
                        # Note: No warning if office conversion not implemented
                    except Exception as e:
                        warnings.append(f"{mslug}: failed to create office document thumbnail: {e}")

        s3_links[mslug] = (s3_private, public_url)

    # Submit async batch processing if enabled and we have media to process
    if async_thumbnails and async_media_batch:
        try:
            from voyage_ingest.async_tasks.media_tasks import process_media_derivatives_batch

            batch_task = process_media_derivatives_batch.delay(async_media_batch, voyage_slug)
            LOG.info("Submitted batch async processing task %s for %d media items in voyage %s",
                    batch_task.id, len(async_media_batch), voyage_slug)
            warnings.append(f"Queued {len(async_media_batch)} media items for async derivative generation (task: {batch_task.id})")
        except Exception as e:
            LOG.error("Failed to submit async batch processing: %s", e)
            warnings.append(f"Failed to queue async processing: {str(e)}")

    return s3_links, warnings
