import os
import time
import json
import subprocess
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class PresignRequest(BaseModel):
    s3_url: str

@router.get("/truman.json")
def get_truman_data():
    """Serve the truman.json file for the curator interface."""
    json_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "truman.json")

    try:
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
        else:
            # Return empty structure if file doesn't exist
            return {
                "truman-harry-s": {
                    "president": {
                        "president_slug": "truman-harry-s",
                        "full_name": "Harry S. Truman",
                        "term_start": "1945-04-12",
                        "term_end": "1953-01-20",
                        "party": "Democratic"
                    },
                    "voyages": [],
                    "passengers": [],
                    "media": []
                }
            }
    except Exception as e:
        logger.error(f"Failed to load truman data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load truman data: {str(e)}")

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


@router.post("/master-doc")
async def save_master_doc(request: Request):
    """Save the MASTER_DOC.md content from the curator interface."""
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
        return {"status": "success", "message": "MASTER_DOC.md saved successfully"}
        
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
    voyage_id: str = Form(...),
    credit: str = Form(""),
    description: str = Form("")
):
    """Upload media files to S3 and return the S3 path."""
    try:
        # Get AWS credentials and S3 client
        s3_client = boto3.client(
            's3',
            region_name=os.getenv('AWS_REGION', 'us-east-1'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        
        bucket_name = os.getenv('PRIVATE_BUCKET', 'sequoia-canonical')
        
        # Create S3 path: media/president/voyage_id/filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'unknown'
        s3_key = f"media/truman-harry-s/{voyage_id}/{file.filename}"
        
        # Upload file to S3
        file_content = await file.read()
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=file_content,
            ContentType=file.content_type or 'application/octet-stream',
            Metadata={
                'voyage_id': voyage_id,
                'credit': credit,
                'description': description,
                'uploaded_by': 'curator_interface'
            }
        )
        
        # Generate public URL
        public_url = f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"
        
        logger.info(f"Media uploaded successfully: {s3_key}")
        
        return {
            "s3_path": s3_key,
            "public_url": public_url,
            "filename": file.filename,
            "size": len(file_content),
            "content_type": file.content_type
        }
        
    except Exception as e:
        logger.error(f"Media upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/save-president-data")
async def save_president_data(request: Request):
    """Save updated president JSON data."""
    try:
        data = await request.json()
        
        # Save to the truman.json file
        json_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "truman.json")
        
        # Create backup
        if os.path.exists(json_path):
            backup_path = f"{json_path}.backup.{int(time.time())}"
            with open(json_path, 'r', encoding='utf-8') as src:
                with open(backup_path, 'w', encoding='utf-8') as dst:
                    dst.write(src.read())
            logger.info(f"Created backup at {backup_path}")
        
        # Write updated data
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info("President data saved successfully")
        return {"status": "success", "message": "Data saved successfully"}
        
    except Exception as e:
        logger.error(f"Failed to save president data: {e}")
        raise HTTPException(status_code=500, detail=f"Save failed: {str(e)}")


@router.post("/trigger-ingestion")
async def trigger_ingestion(request: Request):
    """Trigger the voyage ingestion pipeline."""
    try:
        data = await request.json()
        voyage_id = data.get('voyage_id')
        action = data.get('action', 'update')
        
        logger.info(f"Triggering ingestion for voyage {voyage_id} (action: {action})")
        
        # Run the voyage ingestion script
        script_path = os.path.join(os.path.dirname(__file__), "..", "..", "voyage_ingest", "main.py")
        
        if os.path.exists(script_path):
            # Run the ingestion script
            result = subprocess.run([
                'python', script_path,
                '--source', 'json',
                '--file', os.path.join(os.path.dirname(__file__), "..", "..", "..", "truman.json")
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info("Data ingestion completed successfully")
                return {
                    "status": "success", 
                    "message": "Data ingestion triggered successfully",
                    "output": result.stdout
                }
            else:
                logger.error(f"Ingestion failed: {result.stderr}")
                return {
                    "status": "warning",
                    "message": "Ingestion script ran with errors", 
                    "error": result.stderr
                }
        else:
            logger.warning("Ingestion script not found, data saved but not ingested")
            return {
                "status": "warning",
                "message": "Data saved but ingestion script not available"
            }
        
    except Exception as e:
        logger.error(f"Failed to trigger ingestion: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")