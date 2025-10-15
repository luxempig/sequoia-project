"""
S3 Browser API - List and navigate S3 bucket contents
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query, HTTPException
import boto3
from botocore.exceptions import ClientError
import os
import logging

LOG = logging.getLogger("app.routers.s3_browser")

router = APIRouter(prefix="/api/s3", tags=["s3-browser"])


@router.get("/browse")
def browse_s3_bucket(
    prefix: str = Query("", description="Prefix/folder path to list"),
    bucket: str = Query("sequoia-canonical", description="S3 bucket name")
) -> Dict[str, Any]:
    """
    Browse S3 bucket contents with folder navigation

    Returns both folders (common prefixes) and files (objects)
    """
    try:
        s3_client = boto3.client('s3')

        # Ensure prefix ends with / if not empty
        if prefix and not prefix.endswith('/'):
            prefix += '/'

        # List objects with delimiter to get folder structure
        response = s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix,
            Delimiter='/'
        )

        # Extract folders (common prefixes)
        folders = []
        if 'CommonPrefixes' in response:
            for common_prefix in response['CommonPrefixes']:
                folder_path = common_prefix['Prefix']
                folder_name = folder_path.rstrip('/').split('/')[-1]
                folders.append({
                    'name': folder_name,
                    'path': folder_path,
                    'type': 'folder'
                })

        # Extract files (objects)
        files = []
        if 'Contents' in response:
            for obj in response['Contents']:
                # Skip the prefix itself if it's listed as an object
                if obj['Key'] == prefix:
                    continue

                file_name = obj['Key'].split('/')[-1]
                file_size = obj['Size']
                last_modified = obj['LastModified'].isoformat()

                # Determine file type from extension
                ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
                if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                    file_type = 'image'
                elif ext in ['mp4', 'mov', 'avi', 'webm']:
                    file_type = 'video'
                elif ext == 'pdf':
                    file_type = 'pdf'
                else:
                    file_type = 'document'

                # Generate public URL
                file_url = f"https://{bucket}.s3.amazonaws.com/{obj['Key']}"

                files.append({
                    'name': file_name,
                    'path': obj['Key'],
                    'size': file_size,
                    'last_modified': last_modified,
                    'type': file_type,
                    'url': file_url
                })

        # Build breadcrumb trail
        breadcrumbs = []
        if prefix:
            parts = prefix.rstrip('/').split('/')
            current_path = ''
            for part in parts:
                current_path += part + '/'
                breadcrumbs.append({
                    'name': part,
                    'path': current_path
                })

        return {
            'bucket': bucket,
            'current_prefix': prefix,
            'breadcrumbs': breadcrumbs,
            'folders': folders,
            'files': files,
            'total_items': len(folders) + len(files)
        }

    except ClientError as e:
        LOG.error(f"S3 error browsing bucket: {e}")
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except Exception as e:
        LOG.error(f"Error browsing S3 bucket: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
