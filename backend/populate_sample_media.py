import os
import json
import requests
import boto3
from dotenv import load_dotenv
from voyage_ingest.db_updater import _conn

os.chdir('/home/ec2-user/sequoia-project/backend')
load_dotenv()

# Load the backup with real media
with open('app/canonical_voyages.json.backup.1759276543', 'r') as f:
    data = json.load(f)

# Get S3 client
s3 = boto3.client('s3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)
bucket = os.getenv('S3_BUCKET_NAME', 'sequoia-canonical')

# Get voyages that exist in our database
conn = _conn()
cur = conn.cursor()
cur.execute("SELECT voyage_slug FROM sequoia.voyages LIMIT 20;")
existing_voyages = [row[0] for row in cur.fetchall()]

print(f"Found {len(existing_voyages)} voyages in database")

# Collect media for these voyages
media_to_process = []
for president_slug, pres_data in data.items():
    if isinstance(pres_data, dict) and 'voyages' in pres_data:
        for voyage in pres_data['voyages']:
            voyage_slug = voyage.get('voyage')
            if voyage_slug in existing_voyages and 'media' in voyage:
                for media in voyage['media']:
                    link = media.get('link', '')
                    # Only process direct file links from Drive or Dropbox
                    if link and ('drive.google.com/file' in link or ('dropbox.com' in link and '?dl=0' in link)):
                        media_to_process.append({
                            'voyage_slug': voyage_slug,
                            'media_slug': f"{voyage_slug}-{media.get('media_name', 'media').replace(' ', '-')[:30]}",
                            'title': media.get('media_name', 'Untitled'),
                            'link': link,
                            'type': media.get('type', 'unknown'),
                            'source': media.get('source', ''),
                            'date': media.get('date', '')
                        })

# Limit to first 20 for testing
media_to_process = media_to_process[:20]

print(f"\nProcessing {len(media_to_process)} media items...")

success_count = 0
fail_count = 0

for i, media in enumerate(media_to_process):
    print(f"\n{i+1}/{len(media_to_process)}: {media['title']}")

    try:
        # Convert Drive/Dropbox links to direct download links
        download_url = media['link']

        if 'drive.google.com' in download_url:
            # Extract file ID from Google Drive link
            if '/file/d/' in download_url:
                file_id = download_url.split('/file/d/')[1].split('/')[0]
                download_url = f"https://drive.google.com/uc?export=download&id={file_id}"

        elif 'dropbox.com' in download_url:
            # Convert Dropbox link to direct download
            download_url = download_url.replace('?dl=0', '?dl=1')

        # Download file
        print(f"  Downloading from: {download_url[:80]}...")
        response = requests.get(download_url, timeout=30, stream=True)
        response.raise_for_status()

        # Determine file extension
        ext = media['type'] if media['type'] != 'unknown' else 'pdf'
        if not ext.startswith('.'):
            ext = f'.{ext}'

        # Upload to S3
        s3_key = f"{media['voyage_slug']}/{media['media_slug']}{ext}"
        print(f"  Uploading to S3: {s3_key}")

        s3.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=response.content,
            ContentType=f'application/{media["type"]}' if media['type'] in ['pdf'] else 'application/octet-stream'
        )

        s3_url = f"https://{bucket}.s3.amazonaws.com/{s3_key}"

        # Insert into database
        cur.execute("""
            INSERT INTO sequoia.media (media_slug, title, media_type, s3_url, credit, date)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (media_slug) DO UPDATE SET
                title = EXCLUDED.title,
                s3_url = EXCLUDED.s3_url
            RETURNING media_slug;
        """, (
            media['media_slug'],
            media['title'],
            media['type'],
            s3_url,
            media['source'],
            media['date'] if media['date'] else None
        ))

        # Link to voyage
        cur.execute("""
            INSERT INTO sequoia.voyage_media (voyage_slug, media_slug, sort_order)
            VALUES (%s, %s, %s)
            ON CONFLICT (voyage_slug, media_slug) DO NOTHING;
        """, (media['voyage_slug'], media['media_slug'], i))

        conn.commit()
        success_count += 1
        print(f"  ✓ Success!")

    except Exception as e:
        print(f"  ✗ Failed: {e}")
        fail_count += 1
        continue

cur.close()
conn.close()

print(f"\n{'='*60}")
print(f"Summary:")
print(f"  Successful: {success_count}")
print(f"  Failed: {fail_count}")
print(f"  Total: {len(media_to_process)}")
