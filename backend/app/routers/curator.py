import os
import time
import json
import subprocess
import asyncio
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory status tracking for ingest operations
ingest_status_store = {}

class IngestStatus:
    def __init__(self, operation_id: str):
        self.operation_id = operation_id
        self.status = "initializing"  # initializing, running, completed, failed
        self.start_time = datetime.utcnow()
        self.end_time = None
        self.progress = 0  # 0-100
        self.current_step = "Starting..."
        self.steps_completed = 0
        self.total_steps = 5  # estimate based on main.py workflow
        self.output_lines = []
        self.error_message = None
        self.voyages_processed = 0
        self.validation_errors = 0
        self.media_warnings = 0

    def update_progress(self, step: str, progress: int = None):
        self.current_step = step
        if progress is not None:
            self.progress = min(100, max(0, progress))
        logger.info(f"[{self.operation_id}] {step} (Progress: {self.progress}%)")

    def add_output_line(self, line: str):
        self.output_lines.append(f"[{datetime.utcnow().isoformat()[:19]}] {line}")
        # Keep only last 100 lines to prevent memory issues
        if len(self.output_lines) > 100:
            self.output_lines = self.output_lines[-100:]

    def complete(self, success: bool, error_message: str = None):
        self.status = "completed" if success else "failed"
        self.end_time = datetime.utcnow()
        self.progress = 100 if success else self.progress
        if error_message:
            self.error_message = error_message

    def to_dict(self):
        duration = None
        if self.end_time:
            duration = (self.end_time - self.start_time).total_seconds()
        elif self.status == "running":
            duration = (datetime.utcnow() - self.start_time).total_seconds()

        return {
            "operation_id": self.operation_id,
            "status": self.status,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": duration,
            "progress": self.progress,
            "current_step": self.current_step,
            "steps_completed": self.steps_completed,
            "total_steps": self.total_steps,
            "voyages_processed": self.voyages_processed,
            "validation_errors": self.validation_errors,
            "media_warnings": self.media_warnings,
            "recent_output": self.output_lines[-10:],  # Last 10 lines
            "error_message": self.error_message
        }

class PresignRequest(BaseModel):
    s3_url: str

@router.get("/debug-paths")
def debug_paths():
    """Debug endpoint to check file paths and existence."""
    current_dir = os.path.dirname(__file__)
    output_path = os.path.join(os.path.dirname(__file__), "..", "canonical_voyages.json")

    # Also check for the file in a few other likely locations
    alt_paths = [
        os.path.join(current_dir, "..", "..", "output.json"),
        os.path.join(current_dir, "..", "voyage_ingest", "output.json"),
        "/home/ec2-user/sequoia-project/backend/voyage_ingest/timeline_translate/voyage_translate/output.json",
        "/home/ec2-user/sequoia-project/output.json"
    ]

    result = {
        "current_dir": current_dir,
        "expected_output_path": output_path,
        "output_exists": os.path.exists(output_path),
        "alternative_paths": {}
    }

    for path in alt_paths:
        result["alternative_paths"][path] = os.path.exists(path)

    # List contents of expected directory
    expected_dir = os.path.dirname(output_path)
    if os.path.exists(expected_dir):
        result["expected_dir_contents"] = os.listdir(expected_dir)
    else:
        result["expected_dir_contents"] = "Directory does not exist"

    return result

@router.get("/canonical_timeline.json")
def get_canonical_timeline_data():
    """Serve the canonical timeline data from output.json for the curator interface."""
    # Use output.json as the source of truth (fullest timeline data)
    output_path = os.path.join(os.path.dirname(__file__), "..", "canonical_voyages.json")

    try:
        logger.info(f"Attempting to load output.json from: {output_path}")
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"File exists: {os.path.exists(output_path)}")

        if os.path.exists(output_path):
            with open(output_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"Successfully loaded output.json with {len(data)} presidents")
            return data
        else:
            logger.warning(f"output.json not found at {output_path}")
            # Return empty structure if file doesn't exist
            return {
                "truman-harry": {
                    "term_start": "April 12, 1945",
                    "term_end": "January 20, 1953",
                    "info": "Harry S. Truman (April 12, 1945 to January 20, 1953)",
                    "voyages": []
                }
            }
    except Exception as e:
        logger.error(f"Failed to load output.json voyage data: {e}")
        logger.error(f"Attempted path: {output_path}")
        logger.error(f"File exists: {os.path.exists(output_path)}")
        raise HTTPException(status_code=500, detail=f"Failed to load voyage data: {str(e)}")

@router.get("/master-doc")
async def get_master_doc():
    """Return the MASTER_DOC.md content for the curator interface."""
    try:
        master_doc_path = os.path.join(os.path.dirname(__file__), "..", "..", "tools", "MASTER_DOC.md")
        
        if os.path.exists(master_doc_path):
            with open(master_doc_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return PlainTextResponse(content, media_type="text/plain; charset=utf-8")
        else:
            # Fallback content if file doesn't exist
            fallback_content = """## President

president_slug: roosevelt-franklin
full_name: Franklin D. Roosevelt
party: Democratic
term_start: 1933-03-04
term_end: 1945-04-12
wikipedia_url: https://en.wikipedia.org/wiki/Franklin_D._Roosevelt
tags: fdr, owner, potus

---

## Voyage

title: Voyage with Henry L. Roosevelt
start_date: 1933-04-21
origin: Potomac River
vessel_name: USS Sequoia
tags: fdr

---

## Passengers

- slug: roosevelt-henry-l
  full_name: Henry L. Roosevelt
  role_title:
  wikipedia_url: https://en.wikipedia.org/wiki/Henry_L._Roosevelt

---

## Media

- credit: Sequoia Logbook p5
  date: 1933
  google_drive_link: https://drive.google.com/file/d/1ArrE6smmcCFXzVwaGP7WJuwiFsJGuxiX/view?usp=sharing#page=6
  description: ""
  tags:

## Voyage

title: Discussion of war debts, currency stabilization (FDR leaves Gold Standard one week before), disarmament
start_date: 1933-04-23
origin: Potomac River  
vessel_name: USS Sequoia
summary: |
  Discussion of war debts, currency stabilization (FDR leaves Gold Standard one week before), disarmament
tags: fdr

---

## Passengers

- slug: roosevelt-franklin-delano
  full_name: Franklin Delano Roosevelt
  role_title: POTUS
  wikipedia_url: https://en.wikipedia.org/wiki/Franklin_D._Roosevelt

- slug: roosevelt-eleanor
  full_name: Eleanor Roosevelt
  role_title: First Lady
  wikipedia_url: https://en.wikipedia.org/wiki/Eleanor_Roosevelt

- slug: macdonald-ramsay
  full_name: Ramsay MacDonald
  role_title: UK Prime Minister
  wikipedia_url: https://en.wikipedia.org/wiki/Ramsay_MacDonald

- slug: macdonald-ishbesl
  full_name: Ishbesl MacDonald
  role_title: Ramsay MacDonald's daughter
  wikipedia_url: https://en.wikipedia.org/wiki/Ishbel_MacDonald

- slug: vansittart-sir-robert
  full_name: Sir Robert Vansittart
  role_title: Permanent Under-Secretary at the Foreign Office
  wikipedia_url: https://en.wikipedia.org/wiki/Robert_Vansittart,_1st_Baron_Vansittart

- slug: vansittart-lady
  full_name: Lady Vansittart (Sarita Enriqueta Vansittart)
  role_title:
  wikipedia_url:

- slug: barlow-mr
  full_name: Mr. Barlow
  role_title:
  wikipedia_url: https://en.wikipedia.org/wiki/Alan_Barlow

- slug: rowlston-mr
  full_name: Mr. Rowlston
  role_title:
  wikipedia_url:

- slug: howe-col-louis-m
  full_name: Col. Louis M. Howe
  role_title: Secretary to the President
  wikipedia_url: https://en.wikipedia.org/wiki/Louis_Howe

- slug: roosevelt-james
  full_name: James Roosevelt
  role_title: Son of FDR
  wikipedia_url: https://en.wikipedia.org/wiki/James_Roosevelt

---

## Media

- credit: FDR_Day_by_Day
  date: 1933
  google_drive_link: https://drive.google.com/file/d/example1
  description: "Day by day presidential calendar entry"
  tags: fdr, calendar

- credit: Sequoia Logbook p7
  date: 1933
  google_drive_link: https://drive.google.com/file/d/example2
  description: "Official ship's log entry"
  tags: logbook, official

- credit: The_Piqua_Daily_Call
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example3
  description: "Newspaper coverage of the meeting"
  tags: newspaper, coverage

- credit: The_Philadelphia_Inquirer_full_pg3
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example4
  description: "Philadelphia Inquirer full page coverage"
  tags: newspaper, philadelphia

- credit: St_Louis_Globe_Democrat_at_Newspapers_com_pg4
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example5
  description: "St. Louis Globe Democrat coverage"
  tags: newspaper, missouri

- credit: The_Baltimore_Sun_pg2
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example6
  description: "Baltimore Sun page 2 coverage"
  tags: newspaper, baltimore

- credit: The_Morning_Call_pg1
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example7
  description: "Morning Call front page coverage"
  tags: newspaper, frontpage

- credit: Wilmington_Daily_Press_Journal_pg1
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example8
  description: "Wilmington Daily Press Journal front page"
  tags: newspaper, delaware

- credit: Wilmington_Daily_Press_Journal_pg8
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example9
  description: "Wilmington Daily Press Journal page 8"
  tags: newspaper, delaware

- credit: The_Los_Angeles_Times_pg2
  date: 1933-04-24
  google_drive_link: https://drive.google.com/file/d/example10
  description: "Los Angeles Times page 2 coverage"
  tags: newspaper, california"""
            
            return PlainTextResponse(fallback_content, media_type="text/plain; charset=utf-8")
    
    except Exception as e:
        # Return fallback content on any error
        fallback_content = """## USS Sequoia Master Document

Error loading full document. Please check backend logs.

## President

president_slug: roosevelt-franklin
full_name: Franklin D. Roosevelt
party: Democratic
term_start: 1933-03-04
term_end: 1945-04-12"""
        
        return PlainTextResponse(fallback_content, media_type="text/plain; charset=utf-8")


@router.get("/canonical-voyages")
async def get_canonical_voyages():
    """Get the canonical_voyages.json data for editing."""
    try:
        canonical_path = os.path.join(os.path.dirname(__file__), "..", "..", "canonical_voyages.json")

        if not os.path.exists(canonical_path):
            raise HTTPException(status_code=404, detail="canonical_voyages.json not found")

        with open(canonical_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return data

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in canonical_voyages.json: {e}")
        raise HTTPException(status_code=500, detail=f"Invalid JSON format: {str(e)}")
    except Exception as e:
        logger.error(f"Failed to load canonical_voyages.json: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load file: {str(e)}")


@router.post("/canonical-voyages")
async def save_canonical_voyages(request: Request):
    """Save canonical_voyages.json without triggering ingest."""
    try:
        data = await request.json()

        # Basic validation of the data structure
        if not isinstance(data, dict):
            raise ValueError("Invalid data format: expected JSON object")

        canonical_path = os.path.join(os.path.dirname(__file__), "..", "..", "canonical_voyages.json")

        # Create backup of existing file
        if os.path.exists(canonical_path):
            backup_path = f"{canonical_path}.backup.{int(time.time())}"
            with open(canonical_path, 'r', encoding='utf-8') as src:
                with open(backup_path, 'w', encoding='utf-8') as dst:
                    dst.write(src.read())
            logger.info(f"Created backup at {backup_path}")

        # Write new content
        with open(canonical_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        file_size = os.path.getsize(canonical_path)
        logger.info(f"canonical_voyages.json saved successfully ({file_size} bytes)")

        return {
            "status": "success",
            "message": "canonical_voyages.json saved successfully (no ingest triggered)",
            "file_size": file_size
        }

    except Exception as e:
        logger.error(f"Failed to save canonical_voyages.json: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.post("/master-doc")
async def save_master_doc(request: Request):
    """Save the MASTER_DOC.md content from the curator interface (legacy format - not used by ingest)."""
    try:
        # Read the raw body as text content
        content = await request.body()
        content = content.decode('utf-8')

        if not content:
            raise HTTPException(status_code=400, detail="Content is required")

        master_doc_path = os.path.join(os.path.dirname(__file__), "..", "..", "tools", "MASTER_DOC.md")

        # Create backup of existing file
        if os.path.exists(master_doc_path):
            backup_path = f"{master_doc_path}.backup.{int(time.time())}"
            with open(master_doc_path, 'r', encoding='utf-8') as src:
                with open(backup_path, 'w', encoding='utf-8') as dst:
                    dst.write(src.read())
            logger.info(f"Created backup at {backup_path}")

        # Write new content
        with open(master_doc_path, 'w', encoding='utf-8') as f:
            f.write(content)

        logger.info(f"Successfully saved MASTER_DOC.md ({len(content)} characters)")

        # Note: MASTER_DOC.md is a legacy format. For automatic ingest, edit canonical_voyages.json directly.
        return {
            "status": "success",
            "message": "MASTER_DOC.md saved successfully (Note: This is a legacy format and won't trigger ingest. Edit canonical_voyages.json for automatic ingestion.)"
        }

    except Exception as e:
        logger.error(f"Failed to save MASTER_DOC.md: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save document: {str(e)}")


@router.get("/s3-structure")
async def get_s3_structure():
    """Get the real S3 bucket structure from sequoia-canonical."""
    try:
        s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION', 'us-east-1'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        bucket_name = os.getenv('PRIVATE_BUCKET', 'sequoia-canonical')
        
        # List all objects in the bucket
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket_name)
        
        structure = {}
        
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    size = obj['Size']
                    last_modified = obj['LastModified'].isoformat()
                    
                    # Parse the path to build directory structure
                    parts = key.split('/')
                    current_path = '/'
                    
                    for i, part in enumerate(parts):
                        if i == len(parts) - 1 and part:  # This is a file
                            if current_path not in structure:
                                structure[current_path] = []
                            
                            # Get file extension
                            extension = part.split('.')[-1] if '.' in part else ''
                            
                            structure[current_path].append({
                                'name': part,
                                'type': 'file',
                                'size': f"{size / 1024:.1f} KB" if size < 1024*1024 else f"{size / (1024*1024):.1f} MB",
                                'lastModified': last_modified[:10],  # Just date part
                                'extension': extension,
                                's3Url': key
                            })
                        elif part:  # This is a directory part
                            new_path = current_path + part + '/' if current_path == '/' else current_path + part + '/'
                            
                            if current_path not in structure:
                                structure[current_path] = []
                            
                            # Add folder if not already present
                            folder_exists = any(item['name'] == part and item['type'] == 'folder' 
                                              for item in structure[current_path])
                            if not folder_exists:
                                structure[current_path].append({
                                    'name': part,
                                    'type': 'folder'
                                })
                            
                            current_path = new_path
        
        return {"structure": structure}
        
    except Exception as e:
        logger.error(f"Failed to get S3 structure: {e}")
        # Return fallback structure based on known patterns
        fallback_structure = {
            "/": [{"name": "media", "type": "folder"}],
            "/media/": [
                {"name": "roosevelt-franklin", "type": "folder"},
                {"name": "truman-harry", "type": "folder"},
                {"name": "eisenhower-dwight", "type": "folder"}
            ]
        }
        return {"structure": fallback_structure}


@router.post("/presign-url")
async def get_presigned_url(request: PresignRequest):
    """Generate a presigned URL for accessing S3 files."""
    try:
        # Get AWS credentials from environment
        s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION', 'us-east-1'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        # Parse bucket and key from s3_url
        # Expected format: "media/president/source/voyage/extension/file.ext"
        bucket_name = os.getenv('PRIVATE_BUCKET', 'sequoia-canonical')
        key = request.s3_url
        
        # Generate presigned URL (valid for 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': key},
            ExpiresIn=3600  # 1 hour
        )
        
        return {"presigned_url": presigned_url}
        
    except NoCredentialsError:
        logger.error("AWS credentials not found")
        raise HTTPException(status_code=500, detail="AWS credentials not configured")
    except ClientError as e:
        logger.error(f"AWS S3 error: {e}")
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchKey':
            raise HTTPException(status_code=404, detail="File not found")
        elif error_code == 'AccessDenied':
            raise HTTPException(status_code=403, detail="Access denied to file")
        else:
            raise HTTPException(status_code=500, detail=f"S3 error: {error_code}")
    except Exception as e:
        logger.error(f"Unexpected error generating presigned URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate presigned URL")


@router.post("/upload-media")
async def upload_media(
    file: UploadFile = File(...),
    voyage_slug: str = Form(...),
    credit: str = Form(""),
    title: str = Form(""),
    date: str = Form(""),
    media_type: str = Form("image")
):
    """Upload media files to S3 and insert directly into database."""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        import re

        # Get AWS credentials and S3 client
        s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION', 'us-east-2'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )

        # Determine media type from file extension if not provided
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'unknown'
        if not media_type or media_type == "image":
            if file_extension in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                media_type = "image"
            elif file_extension in ['mp4', 'mov', 'avi', 'webm']:
                media_type = "video"
            elif file_extension == 'pdf':
                media_type = "pdf"
            elif file_extension in ['mp3', 'wav', 'flac']:
                media_type = "audio"
            else:
                media_type = "other"

        # Generate media slug from filename
        base_name = file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename
        media_slug = re.sub(r'[^a-z0-9-]+', '-', base_name.lower()).strip('-')
        media_slug = f"{voyage_slug}-{media_slug}-{int(time.time())}"

        bucket_name = os.getenv('PRIVATE_BUCKET', 'sequoia-canonical-media')

        # Create S3 path: media/voyage_slug/filename
        s3_key = f"s3://{bucket_name}/{voyage_slug}/{file.filename}"
        s3_key_raw = f"{voyage_slug}/{file.filename}"

        # Upload file to S3
        file_content = await file.read()
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key_raw,
            Body=file_content,
            ContentType=file.content_type or 'application/octet-stream',
            Metadata={
                'voyage_slug': voyage_slug,
                'credit': credit,
                'media_slug': media_slug,
                'uploaded_by': 'curator_interface'
            }
        )

        logger.info(f"Media uploaded to S3: {s3_key}")

        # Insert into database
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT", "5432")),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Set schema
        schema = os.getenv("DB_SCHEMA", "sequoia")
        cur.execute(f"SET search_path = {schema}, public;")

        # Insert media record
        cur.execute("""
            INSERT INTO media (media_slug, title, media_type, s3_url, credit, date, description_markdown)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (media_slug) DO UPDATE SET
                title=EXCLUDED.title, media_type=EXCLUDED.media_type, s3_url=EXCLUDED.s3_url,
                credit=EXCLUDED.credit, date=EXCLUDED.date, description_markdown=EXCLUDED.description_markdown
            RETURNING media_slug;
        """, (media_slug, title or file.filename, media_type, s3_key, credit, date or None, title))

        result = cur.fetchone()

        # Create voyage_media join
        cur.execute("""
            INSERT INTO voyage_media (voyage_slug, media_slug, sort_order)
            VALUES (%s, %s, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM voyage_media WHERE voyage_slug = %s))
            ON CONFLICT (voyage_slug, media_slug) DO NOTHING;
        """, (voyage_slug, media_slug, voyage_slug))

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Media inserted into database: {media_slug}")

        return {
            "media_slug": media_slug,
            "s3_key": s3_key,
            "filename": file.filename,
            "size": len(file_content),
            "media_type": media_type,
            "message": "Media uploaded to S3 and saved to database"
        }

    except Exception as e:
        logger.error(f"Media upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/save-president-data")
async def save_president_data(request: Request, background_tasks: BackgroundTasks):
    """Save updated voyage data to canonical file and trigger automatic ingest."""
    operation_id = f"curator_save_{int(time.time())}"
    status_tracker = IngestStatus(operation_id)
    ingest_status_store[operation_id] = status_tracker

    try:
        status_tracker.update_progress("Loading and validating data...", 10)
        data = await request.json()

        # Basic validation of the data structure
        if not isinstance(data, dict):
            raise ValueError("Invalid data format: expected JSON object")

        # Count voyages for progress tracking
        total_voyages = 0
        for president_data in data.values():
            if isinstance(president_data, dict) and "voyages" in president_data:
                total_voyages += len(president_data.get("voyages", []))
        status_tracker.voyages_processed = 0  # Reset counter
        status_tracker.add_output_line(f"Found {total_voyages} total voyages to process")

        status_tracker.update_progress("Creating backup of existing data...", 20)
        # Save to the canonical_voyages.json file (source of truth)
        output_path = os.path.join(os.path.dirname(__file__), "..", "canonical_voyages.json")

        # Load existing data to merge with incoming changes
        existing_data = {}
        if os.path.exists(output_path):
            # Create backup of existing output file
            backup_path = f"{output_path}.backup.{int(time.time())}"
            with open(output_path, 'r', encoding='utf-8') as src:
                file_content = src.read()
                existing_data = json.loads(file_content)
                with open(backup_path, 'w', encoding='utf-8') as dst:
                    dst.write(file_content)
            logger.info(f"Created backup at {backup_path}")
            status_tracker.add_output_line(f"Backup created: {os.path.basename(backup_path)}")

        # Merge incoming data with existing data (preserving other presidents)
        merged_data = {**existing_data, **data}

        status_tracker.update_progress("Writing canonical_voyages.json data file...", 30)
        # Write merged data to canonical_voyages.json file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(merged_data, f, indent=2, ensure_ascii=False)

        file_size = os.path.getsize(output_path)
        logger.info("Output.json voyage data saved successfully")
        status_tracker.add_output_line(f"Output.json file saved ({file_size} bytes)")
        status_tracker.update_progress("Starting automatic ingest...", 40)

        # Trigger ingest in background and return immediately
        background_tasks.add_task(run_ingest_in_background, status_tracker)

        return {
            "status": "processing",
            "message": "Data saved, ingestion in progress",
            "operation_id": operation_id
        }

    except Exception as e:
        logger.error(f"Failed to save canonical voyage data: {e}")
        status_tracker.complete(False, str(e))
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")


async def run_ingest_in_background(status_tracker: IngestStatus):
    """Background task to run ingest after save."""
    try:
        ingest_result = await trigger_canonical_ingest_with_tracking(status_tracker)
        if ingest_result["status"] == "success":
            status_tracker.complete(True)
            logger.info(f"Background ingest completed successfully for operation {status_tracker.operation_id}")
        else:
            status_tracker.complete(False, ingest_result.get("error", "Unknown ingest error"))
            logger.error(f"Background ingest failed for operation {status_tracker.operation_id}: {ingest_result.get('error')}")
    except Exception as e:
        logger.error(f"Background ingest exception for operation {status_tracker.operation_id}: {e}")
        status_tracker.complete(False, str(e))


async def trigger_canonical_ingest():
    """Helper function to trigger ingest from canonical voyages file (legacy version)."""
    operation_id = f"trigger_{int(time.time())}"
    status_tracker = IngestStatus(operation_id)
    ingest_status_store[operation_id] = status_tracker

    return await trigger_canonical_ingest_with_tracking(status_tracker)


async def trigger_canonical_ingest_with_tracking(status_tracker: IngestStatus):
    """Enhanced ingest function with detailed progress tracking."""
    status_tracker.update_progress("Validating paths and dependencies...", 50)

    script_path = os.path.join(os.path.dirname(__file__), "..", "..", "voyage_ingest", "main.py")
    output_path = os.path.join(os.path.dirname(__file__), "..", "..", "canonical_voyages.json")

    if not os.path.exists(script_path):
        error_msg = f"Ingestion script not found at {script_path}"
        status_tracker.add_output_line(f"ERROR: {error_msg}")
        return {
            "status": "error",
            "message": "Ingestion script not found",
            "error": error_msg
        }

    if not os.path.exists(output_path):
        error_msg = f"Output.json file not found at {output_path}"
        status_tracker.add_output_line(f"ERROR: {error_msg}")
        return {
            "status": "error",
            "message": "Output.json file not found",
            "error": error_msg
        }

    # Validate output.json file is readable JSON
    try:
        with open(output_path, 'r') as f:
            output_data = json.load(f)
        voyage_count = sum(len(p.get("voyages", [])) for p in output_data.values() if isinstance(p, dict))
        status_tracker.add_output_line(f"Output.json file validated: {voyage_count} voyages found")
    except Exception as e:
        error_msg = f"Invalid output.json file format: {str(e)}"
        status_tracker.add_output_line(f"ERROR: {error_msg}")
        return {
            "status": "error",
            "message": "Invalid output.json file format",
            "error": error_msg
        }

    status_tracker.update_progress("Running voyage ingestion pipeline...", 60)
    status_tracker.status = "running"

    try:
        # Run the ingestion script as a module from the backend directory
        backend_dir = os.path.join(os.path.dirname(__file__), "..", "..")
        env = os.environ.copy()
        env['PYTHONDONTWRITEBYTECODE'] = '1'  # Disable bytecode to ensure fresh code loads
        process = subprocess.Popen([
            'python3', '-m', 'voyage_ingest.main',
            '--source', 'json',
            '--file', output_path
        ], cwd=backend_dir, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1, universal_newlines=True, env=env)

        # Real-time output processing with timeout
        output_lines = []
        start_time = time.time()
        timeout = 600  # 10 minute timeout

        while True:
            try:
                # Check for timeout
                if time.time() - start_time > timeout:
                    process.terminate()
                    status_tracker.add_output_line("ERROR: Process terminated due to timeout (10 minutes)")
                    return {
                        "status": "error",
                        "message": "Ingestion timed out after 10 minutes",
                        "error": "Process timeout",
                        "output": "\n".join(output_lines)
                    }

                # Read output line by line
                line = process.stdout.readline()
                if not line:
                    if process.poll() is not None:
                        break
                    await asyncio.sleep(0.1)  # Brief pause if no output
                    continue

                line = line.strip()
                if line:
                    output_lines.append(line)
                    status_tracker.add_output_line(line)

                    # Parse progress indicators from output
                    if "Processing voyage" in line and "/" in line:
                        try:
                            # Extract "x/y" pattern
                            parts = line.split("Processing voyage")[1].split(":")[0].strip()
                            current, total = map(int, parts.split("/"))
                            progress = 60 + (current / total) * 30  # Map to 60-90% range
                            status_tracker.update_progress(f"Processing voyage {current}/{total}", int(progress))
                            status_tracker.voyages_processed = current
                        except:
                            pass  # Continue on parsing errors
                    elif "validation error" in line.lower():
                        status_tracker.validation_errors += 1
                    elif "media issue" in line.lower() or "warning" in line.lower():
                        status_tracker.media_warnings += 1
                    elif "Completed successfully" in line:
                        status_tracker.update_progress("Finalizing...", 95)

            except Exception as e:
                logger.warning(f"Error reading process output: {e}")
                break

        # Wait for process completion
        return_code = process.wait()

        # Parse final results
        output_text = "\n".join(output_lines)

        if return_code == 0:
            logger.info("Canonical data ingestion completed successfully")
            status_tracker.update_progress("Ingestion completed successfully", 100)

            # Extract summary statistics from output
            summary = {
                "voyages_processed": status_tracker.voyages_processed,
                "validation_errors": status_tracker.validation_errors,
                "media_warnings": status_tracker.media_warnings,
                "duration_seconds": time.time() - start_time
            }

            return {
                "status": "success",
                "message": "Canonical data ingestion completed successfully",
                "output": output_text,
                "summary": summary
            }
        else:
            logger.error(f"Canonical ingestion failed with code {return_code}")
            status_tracker.add_output_line(f"Process failed with exit code {return_code}")

            # Extract error details
            error_lines = [line for line in output_lines if "error" in line.lower() or "failed" in line.lower()]
            main_error = error_lines[0] if error_lines else f"Process exited with code {return_code}"

            return {
                "status": "error",
                "message": "Ingestion script ran with errors",
                "error": main_error,
                "output": output_text,
                "summary": {
                    "voyages_processed": status_tracker.voyages_processed,
                    "validation_errors": status_tracker.validation_errors,
                    "media_warnings": status_tracker.media_warnings,
                    "duration_seconds": time.time() - start_time
                }
            }

    except Exception as e:
        logger.error(f"Failed to run canonical ingestion: {e}")
        status_tracker.add_output_line(f"EXCEPTION: {str(e)}")
        return {
            "status": "error",
            "message": "Failed to execute ingestion script",
            "error": str(e)
        }


@router.post("/trigger-ingestion")
async def trigger_ingestion(request: Request):
    """Trigger the voyage ingestion pipeline from canonical file."""
    try:
        # Accept optional data but don't require it
        data = {}
        try:
            data = await request.json()
        except:
            pass  # No JSON body provided, that's fine

        logger.info("Triggering canonical voyage data ingestion")

        result = await trigger_canonical_ingest()

        if result["status"] == "success":
            return result
        else:
            # Return the error but don't raise HTTPException so curator can handle gracefully
            return result

    except Exception as e:
        logger.error(f"Failed to trigger canonical ingestion: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.get("/ingest-status/{operation_id}")
async def get_ingest_status(operation_id: str):
    """Get the current status of an ingest operation."""
    if operation_id not in ingest_status_store:
        raise HTTPException(status_code=404, detail="Operation not found")

    status = ingest_status_store[operation_id]
    return JSONResponse(content=status.to_dict())


@router.get("/ingest-status")
async def get_all_ingest_status():
    """Get status of all recent ingest operations."""
    # Return last 10 operations, newest first
    recent_ops = list(ingest_status_store.items())[-10:]
    recent_ops.reverse()

    return {
        "operations": [status.to_dict() for _, status in recent_ops],
        "active_operations": len([s for s in ingest_status_store.values() if s.status == "running"]),
        "total_operations": len(ingest_status_store)
    }


@router.delete("/ingest-status/{operation_id}")
async def clear_ingest_status(operation_id: str):
    """Clear a specific ingest operation from status tracking."""
    if operation_id in ingest_status_store:
        del ingest_status_store[operation_id]
        return {"status": "success", "message": "Operation status cleared"}
    else:
        raise HTTPException(status_code=404, detail="Operation not found")


@router.delete("/ingest-status")
async def clear_all_ingest_status():
    """Clear all completed ingest operations from status tracking."""
    # Keep only running operations
    running_ops = {k: v for k, v in ingest_status_store.items() if v.status == "running"}
    cleared_count = len(ingest_status_store) - len(running_ops)
    ingest_status_store.clear()
    ingest_status_store.update(running_ops)

    return {
        "status": "success",
        "message": f"Cleared {cleared_count} completed operations",
        "remaining_operations": len(running_ops)
    }


@router.post("/trigger-manual-ingest")
async def trigger_manual_ingest():
    """Manually trigger canonical voyage ingest (for testing/admin use)."""
    try:
        operation_id = f"manual_{int(time.time())}"
        logger.info(f"Manual canonical voyage data ingestion triggered [{operation_id}]")

        # Create status tracker for manual operation
        status_tracker = IngestStatus(operation_id)
        ingest_status_store[operation_id] = status_tracker

        result = await trigger_canonical_ingest_with_tracking(status_tracker)

        # Update final status
        if result["status"] == "success":
            status_tracker.complete(True)
        else:
            status_tracker.complete(False, result.get("error", "Unknown error"))

        result["operation_id"] = operation_id
        return result

    except Exception as e:
        logger.error(f"Manual ingestion trigger failed: {e}")
        raise HTTPException(status_code=500, detail=f"Manual ingest failed: {str(e)}")


@router.get("/pipeline-health")
async def get_pipeline_health():
    """Get overall health status of the voyage pipeline."""
    try:
        script_path = os.path.join(os.path.dirname(__file__), "..", "voyage_ingest", "main.py")
        canonical_path = os.path.join(os.path.dirname(__file__), "..", "..", "canonical_voyages.json")

        health_status = {
            "overall_status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "components": {
                "ingest_script": {
                    "status": "available" if os.path.exists(script_path) else "missing",
                    "path": script_path
                },
                "canonical_file": {
                    "status": "available" if os.path.exists(canonical_path) else "missing",
                    "path": canonical_path,
                    "size_bytes": os.path.getsize(canonical_path) if os.path.exists(canonical_path) else 0
                },
                "active_operations": len([s for s in ingest_status_store.values() if s.status == "running"]),
                "recent_errors": len([s for s in ingest_status_store.values() if s.status == "failed"]),
            }
        }

        # Validate canonical file structure if it exists
        if os.path.exists(canonical_path):
            try:
                with open(canonical_path, 'r') as f:
                    canonical_data = json.load(f)
                health_status["components"]["canonical_file"]["voyages_count"] = sum(
                    len(p.get("voyages", [])) for p in canonical_data.values() if isinstance(p, dict)
                )
                health_status["components"]["canonical_file"]["presidents_count"] = len(canonical_data)
            except Exception as e:
                health_status["components"]["canonical_file"]["validation_error"] = str(e)
                health_status["overall_status"] = "degraded"

        # Check for missing components
        if not os.path.exists(script_path) or not os.path.exists(canonical_path):
            health_status["overall_status"] = "unhealthy"

        return health_status

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "overall_status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }