"""
Async thumbnail generation tasks using Celery.
"""
import os
import io
import logging
import time
from typing import Optional, Dict, Any, Tuple
from celery import current_task
import boto3
from PIL import Image

# Import the thumbnail generation functions from drive_sync
try:
    import fitz
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import ffmpeg
    HAS_FFMPEG = True
except ImportError:
    HAS_FFMPEG = False

try:
    import librosa
    import numpy as np
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_AUDIO_LIBS = True
except ImportError:
    HAS_AUDIO_LIBS = False

# Import celery app
from celery_app import celery_app

LOG = logging.getLogger("voyage_ingest.async_tasks.thumbnail_tasks")

# AWS/S3 Configuration
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_PRIVATE_BUCKET = os.environ.get("S3_PRIVATE_BUCKET", "sequoia-canonical")
S3_PUBLIC_BUCKET = os.environ.get("S3_PUBLIC_BUCKET", "sequoia-public")


def _s3():
    return boto3.client("s3", region_name=AWS_REGION)


def _public_http_url(bucket: str, key: str) -> str:
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def _upload_bytes(bucket: str, key: str, data: bytes, content_type: Optional[str] = None) -> None:
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    _s3().put_object(Bucket=bucket, Key=key, Body=data, **extra)


def _s3_key_for_derivative(vslug: str, mslug: str, ext: str, credit: str, kind: str) -> str:
    """Generate S3 key for derivative files (thumbnails, previews)."""
    from voyage_ingest.slugger import normalize_source, president_from_voyage_slug
    source_slug = normalize_source(credit)
    pres_slug = president_from_voyage_slug(vslug)
    return f"media/{pres_slug}/{source_slug}/{vslug}/{ext}/{mslug}_{kind}.jpg"


def _make_image_derivatives(img_bytes: bytes, max_long_edge_preview=1600, thumb_size=320) -> Tuple[bytes, bytes]:
    """Create image preview and thumbnail."""
    with Image.open(io.BytesIO(img_bytes)) as im:
        im = im.convert("RGB")
        w, h = im.size

        # Create preview (larger version)
        if w >= h:
            new_w = min(max_long_edge_preview, w)
            new_h = int(h * (new_w / w))
        else:
            new_h = min(max_long_edge_preview, h)
            new_w = int(w * (new_h / h))

        preview = im.resize((new_w, new_h), Image.LANCZOS)
        buf_prev = io.BytesIO()
        preview.save(buf_prev, format="JPEG", quality=88, optimize=True)

        # Create thumbnail
        im_copy = im.copy()
        im_copy.thumbnail((thumb_size, thumb_size), Image.LANCZOS)
        buf_th = io.BytesIO()
        im_copy.save(buf_th, format="JPEG", quality=85, optimize=True)

        return buf_prev.getvalue(), buf_th.getvalue()


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


def _make_video_thumbnail(video_bytes: bytes, thumb_size=320) -> Optional[bytes]:
    """Create a thumbnail from a video file using ffmpeg."""
    if not HAS_FFMPEG:
        return None

    try:
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


@celery_app.task(bind=True, name="generate_image_derivatives")
def generate_image_derivatives(self, voyage_slug: str, media_slug: str, ext: str,
                             credit: str, s3_original_key: str) -> Dict[str, Any]:
    """
    Async task to generate image preview and thumbnail from S3 original.
    """
    try:
        # Update task state
        self.update_state(
            state="PROCESSING",
            meta={"stage": "downloading_original", "progress": 10}
        )

        # Download original from S3
        s3 = _s3()
        response = s3.get_object(Bucket=S3_PRIVATE_BUCKET, Key=s3_original_key)
        original_bytes = response['Body'].read()

        self.update_state(
            state="PROCESSING",
            meta={"stage": "generating_derivatives", "progress": 40}
        )

        # Generate derivatives
        preview_bytes, thumb_bytes = _make_image_derivatives(original_bytes)

        self.update_state(
            state="PROCESSING",
            meta={"stage": "uploading_derivatives", "progress": 70}
        )

        # Upload derivatives to public bucket
        preview_key = _s3_key_for_derivative(voyage_slug, media_slug, ext, credit, "preview")
        thumb_key = _s3_key_for_derivative(voyage_slug, media_slug, ext, credit, "thumb")

        _upload_bytes(S3_PUBLIC_BUCKET, preview_key, preview_bytes, "image/jpeg")
        _upload_bytes(S3_PUBLIC_BUCKET, thumb_key, thumb_bytes, "image/jpeg")

        # Generate public URLs
        preview_url = _public_http_url(S3_PUBLIC_BUCKET, preview_key)
        thumb_url = _public_http_url(S3_PUBLIC_BUCKET, thumb_key)

        return {
            "status": "success",
            "media_slug": media_slug,
            "preview_url": preview_url,
            "thumbnail_url": thumb_url,
            "preview_key": preview_key,
            "thumbnail_key": thumb_key,
            "processing_time": time.time()
        }

    except Exception as e:
        LOG.error(f"Failed to generate image derivatives for {media_slug}: {e}")
        return {
            "status": "error",
            "media_slug": media_slug,
            "error": str(e),
            "processing_time": time.time()
        }


@celery_app.task(bind=True, name="generate_pdf_thumbnail")
def generate_pdf_thumbnail(self, voyage_slug: str, media_slug: str, ext: str,
                          credit: str, s3_original_key: str) -> Dict[str, Any]:
    """
    Async task to generate PDF thumbnail from S3 original.
    """
    try:
        self.update_state(
            state="PROCESSING",
            meta={"stage": "downloading_pdf", "progress": 20}
        )

        # Download original PDF from S3
        s3 = _s3()
        response = s3.get_object(Bucket=S3_PRIVATE_BUCKET, Key=s3_original_key)
        pdf_bytes = response['Body'].read()

        self.update_state(
            state="PROCESSING",
            meta={"stage": "generating_thumbnail", "progress": 50}
        )

        # Generate thumbnail
        thumb_bytes = _make_pdf_thumbnail(pdf_bytes)

        if not thumb_bytes:
            return {
                "status": "skipped",
                "media_slug": media_slug,
                "reason": "PDF thumbnail generation not available (PyMuPDF not installed)",
                "processing_time": time.time()
            }

        self.update_state(
            state="PROCESSING",
            meta={"stage": "uploading_thumbnail", "progress": 80}
        )

        # Upload thumbnail
        thumb_key = _s3_key_for_derivative(voyage_slug, media_slug, ext, credit, "thumb")
        _upload_bytes(S3_PUBLIC_BUCKET, thumb_key, thumb_bytes, "image/jpeg")

        thumb_url = _public_http_url(S3_PUBLIC_BUCKET, thumb_key)

        return {
            "status": "success",
            "media_slug": media_slug,
            "thumbnail_url": thumb_url,
            "thumbnail_key": thumb_key,
            "processing_time": time.time()
        }

    except Exception as e:
        LOG.error(f"Failed to generate PDF thumbnail for {media_slug}: {e}")
        return {
            "status": "error",
            "media_slug": media_slug,
            "error": str(e),
            "processing_time": time.time()
        }


@celery_app.task(bind=True, name="generate_video_thumbnail")
def generate_video_thumbnail(self, voyage_slug: str, media_slug: str, ext: str,
                           credit: str, s3_original_key: str) -> Dict[str, Any]:
    """
    Async task to generate video thumbnail from S3 original.
    """
    try:
        self.update_state(
            state="PROCESSING",
            meta={"stage": "downloading_video", "progress": 15}
        )

        # Download original video from S3
        s3 = _s3()
        response = s3.get_object(Bucket=S3_PRIVATE_BUCKET, Key=s3_original_key)
        video_bytes = response['Body'].read()

        self.update_state(
            state="PROCESSING",
            meta={"stage": "extracting_frame", "progress": 60}
        )

        # Generate thumbnail
        thumb_bytes = _make_video_thumbnail(video_bytes)

        if not thumb_bytes:
            return {
                "status": "skipped",
                "media_slug": media_slug,
                "reason": "Video thumbnail generation not available (ffmpeg not installed)",
                "processing_time": time.time()
            }

        self.update_state(
            state="PROCESSING",
            meta={"stage": "uploading_thumbnail", "progress": 85}
        )

        # Upload thumbnail
        thumb_key = _s3_key_for_derivative(voyage_slug, media_slug, ext, credit, "thumb")
        _upload_bytes(S3_PUBLIC_BUCKET, thumb_key, thumb_bytes, "image/jpeg")

        thumb_url = _public_http_url(S3_PUBLIC_BUCKET, thumb_key)

        return {
            "status": "success",
            "media_slug": media_slug,
            "thumbnail_url": thumb_url,
            "thumbnail_key": thumb_key,
            "processing_time": time.time()
        }

    except Exception as e:
        LOG.error(f"Failed to generate video thumbnail for {media_slug}: {e}")
        return {
            "status": "error",
            "media_slug": media_slug,
            "error": str(e),
            "processing_time": time.time()
        }


@celery_app.task(bind=True, name="generate_audio_waveform")
def generate_audio_waveform(self, voyage_slug: str, media_slug: str, ext: str,
                          credit: str, s3_original_key: str) -> Dict[str, Any]:
    """
    Async task to generate audio waveform visualization from S3 original.
    """
    try:
        self.update_state(
            state="PROCESSING",
            meta={"stage": "downloading_audio", "progress": 20}
        )

        # Download original audio from S3
        s3 = _s3()
        response = s3.get_object(Bucket=S3_PRIVATE_BUCKET, Key=s3_original_key)
        audio_bytes = response['Body'].read()

        self.update_state(
            state="PROCESSING",
            meta={"stage": "analyzing_audio", "progress": 50}
        )

        # Generate waveform
        waveform_bytes = _make_audio_waveform(audio_bytes)

        if not waveform_bytes:
            return {
                "status": "skipped",
                "media_slug": media_slug,
                "reason": "Audio waveform generation not available (audio libraries not installed)",
                "processing_time": time.time()
            }

        self.update_state(
            state="PROCESSING",
            meta={"stage": "uploading_waveform", "progress": 80}
        )

        # Upload waveform
        waveform_key = _s3_key_for_derivative(voyage_slug, media_slug, ext, credit, "waveform")
        _upload_bytes(S3_PUBLIC_BUCKET, waveform_key, waveform_bytes, "image/jpeg")

        waveform_url = _public_http_url(S3_PUBLIC_BUCKET, waveform_key)

        return {
            "status": "success",
            "media_slug": media_slug,
            "waveform_url": waveform_url,
            "waveform_key": waveform_key,
            "processing_time": time.time()
        }

    except Exception as e:
        LOG.error(f"Failed to generate audio waveform for {media_slug}: {e}")
        return {
            "status": "error",
            "media_slug": media_slug,
            "error": str(e),
            "processing_time": time.time()
        }