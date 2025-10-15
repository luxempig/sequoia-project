"""
Generate thumbnails for existing media and upload to sequoia-public bucket.
"""
import os
import sys
import io
from dotenv import load_dotenv
import boto3
from PIL import Image

# Change to backend directory
backend_dir = '/home/ec2-user/sequoia-project/backend'
os.chdir(backend_dir)
load_dotenv()

# Import after changing directory
sys.path.insert(0, backend_dir)
from voyage_ingest.db_updater import _conn

# Try to import PyMuPDF for PDF thumbnails
try:
    import fitz
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    print("Warning: PyMuPDF not installed, PDF thumbnails will be skipped")

# Unset AWS credentials from .env to use EC2 instance role
for key in ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']:
    os.environ.pop(key, None)

s3 = boto3.client('s3')
private_bucket = 'sequoia-canonical'
public_bucket = 'sequoia-public'

def make_image_thumbnail(img_bytes: bytes, thumb_size=320) -> bytes:
    """Create a thumbnail from an image."""
    with Image.open(io.BytesIO(img_bytes)) as im:
        im = im.convert("RGB")
        im.thumbnail((thumb_size, thumb_size), Image.LANCZOS)

        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue()

def make_pdf_thumbnail(pdf_bytes: bytes, thumb_size=320) -> bytes:
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
        mat = fitz.Matrix(150/72, 150/72)
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
        print(f"  Error creating PDF thumbnail: {e}")
        return None

def generate_thumbnail_key(voyage_slug: str, media_slug: str) -> str:
    """Generate S3 key for thumbnail in public bucket."""
    # Simple structure: thumbnails/{voyage_slug}/{media_slug}.jpg
    return f"thumbnails/{voyage_slug}/{media_slug}.jpg"

# Get all media items that don't have thumbnails yet
conn = _conn()
cur = conn.cursor()

cur.execute("""
    SELECT m.media_slug, m.media_type, m.s3_url, m.public_derivative_url, vm.voyage_slug
    FROM sequoia.media m
    JOIN sequoia.voyage_media vm ON m.media_slug = vm.media_slug
    WHERE m.s3_url IS NOT NULL
    ORDER BY m.media_slug
""")

media_items = cur.fetchall()
print(f"Found {len(media_items)} media items to process\n")

success_count = 0
skip_count = 0
fail_count = 0

for item in media_items:
    media_slug = item['media_slug']
    media_type = item['media_type']
    s3_url = item['s3_url']
    existing_thumbnail = item['public_derivative_url']
    voyage_slug = item['voyage_slug']

    print(f"Processing: {media_slug} ({media_type})")

    # Skip if already has thumbnail
    if existing_thumbnail:
        print(f"  ✓ Already has thumbnail: {existing_thumbnail}")
        skip_count += 1
        continue

    try:
        # Extract bucket and key from S3 URL
        # Format: https://sequoia-canonical.s3.amazonaws.com/voyage-slug/media-slug.ext
        url_parts = s3_url.replace('https://', '').split('/', 1)
        bucket = url_parts[0].replace('.s3.amazonaws.com', '')
        s3_key = url_parts[1]

        # Download original from S3
        print(f"  Downloading from S3: {s3_key}")
        response = s3.get_object(Bucket=bucket, Key=s3_key)
        original_bytes = response['Body'].read()

        # Generate thumbnail based on media type
        thumb_bytes = None

        if media_type == 'image':
            thumb_bytes = make_image_thumbnail(original_bytes)
        elif media_type == 'pdf':
            thumb_bytes = make_pdf_thumbnail(original_bytes)
        else:
            print(f"  ⊘ Skipping: media type '{media_type}' not supported for thumbnails")
            skip_count += 1
            continue

        if not thumb_bytes:
            print(f"  ⊘ Failed to generate thumbnail")
            fail_count += 1
            continue

        # Upload thumbnail to public bucket
        thumb_key = generate_thumbnail_key(voyage_slug, media_slug)
        print(f"  Uploading thumbnail to: {public_bucket}/{thumb_key}")

        s3.put_object(
            Bucket=public_bucket,
            Key=thumb_key,
            Body=thumb_bytes,
            ContentType='image/jpeg',
            CacheControl='public, max-age=31536000'  # Cache for 1 year
        )

        # Generate public URL
        thumbnail_url = f"https://{public_bucket}.s3.amazonaws.com/{thumb_key}"

        # Update database
        cur.execute("""
            UPDATE sequoia.media
            SET public_derivative_url = %s
            WHERE media_slug = %s
        """, (thumbnail_url, media_slug))

        conn.commit()
        success_count += 1
        print(f"  ✓ Success! Thumbnail: {thumbnail_url}")

    except Exception as e:
        print(f"  ✗ Failed: {e}")
        fail_count += 1
        continue

cur.close()
conn.close()

print(f"\n{'='*60}")
print(f"Summary:")
print(f"  Successful: {success_count}")
print(f"  Skipped: {skip_count}")
print(f"  Failed: {fail_count}")
print(f"  Total: {len(media_items)}")
