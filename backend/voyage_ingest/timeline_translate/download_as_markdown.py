import os
import io
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Google Drive API setup
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

class DriveToMarkdownDownloader:
    def __init__(self, credentials_file: str = '../../keys/sequoia_credentials.json'):
        self.credentials_file = credentials_file
        self.drive_service = None
        self.setup_google_drive()
        
    def setup_google_drive(self):
        """Set up Google Drive API connection using service account."""
        try:
            # Load service account credentials
            creds = service_account.Credentials.from_service_account_file(
                self.credentials_file, scopes=SCOPES)
            
            self.drive_service = build('drive', 'v3', credentials=creds)
            print("Connected to Google Drive API")
        except Exception as e:
            print(f"Error setting up Google Drive API: {e}")
            raise
        
    def find_folder_by_name(self, folder_name: str, parent_id: Optional[str] = None) -> Optional[str]:
        """Find a folder by name, optionally within a parent folder."""
        try:
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder'"
            if parent_id:
                query += f" and '{parent_id}' in parents"
            
            results = self.drive_service.files().list(
                q=query,
                fields='files(id, name, parents)'
            ).execute()
            
            files = results.get('files', [])
            if files:
                return files[0]['id']
            return None
            
        except Exception as e:
            print(f"Error finding folder '{folder_name}': {e}")
            return None
    
    def list_folders(self, parent_id: Optional[str] = None, max_results: int = 50) -> List[Dict[str, str]]:
        """List all folders, optionally within a parent folder."""
        try:
            query = "mimeType='application/vnd.google-apps.folder'"
            if parent_id:
                query += f" and '{parent_id}' in parents"
            
            results = self.drive_service.files().list(
                q=query,
                pageSize=max_results,
                fields='files(id, name, parents)',
                orderBy='name'
            ).execute()
            
            return results.get('files', [])
            
        except Exception as e:
            print(f"Error listing folders: {e}")
            return []
    
    def get_folder_contents(self, folder_id: str) -> List[Dict[str, Any]]:
        """Get all files and folders within a specific folder."""
        try:
            all_items = []
            page_token = None
            
            while True:
                results = self.drive_service.files().list(
                    q=f"'{folder_id}' in parents",
                    pageSize=100,
                    fields='nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)',
                    pageToken=page_token,
                    orderBy='name'
                ).execute()
                
                items = results.get('files', [])
                all_items.extend(items)
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
            
            return all_items
            
        except Exception as e:
            print(f"Error getting folder contents: {e}")
            return []
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for local file system."""
        # Remove or replace invalid characters
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        # Remove extra spaces and dots
        filename = re.sub(r'\s+', ' ', filename).strip()
        filename = filename.strip('.')
        # Limit length
        if len(filename) > 200:
            filename = filename[:200]
        return filename
    
    def download_google_doc_as_markdown(self, file_id: str, file_name: str, output_path: str) -> bool:
        """Download a Google Doc as markdown."""
        try:
            # Export as plain text first (closest to markdown for Google Docs)
            request = self.drive_service.files().export_media(
                fileId=file_id,
                mimeType='text/plain'
            )
            
            file_content = io.BytesIO()
            downloader = MediaIoBaseDownload(file_content, request)
            
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            
            # Get the content and convert to string
            content = file_content.getvalue().decode('utf-8')
            
            # Basic conversion to markdown-like format
            content = self.convert_to_markdown_format(content)
            
            # Save as .md file
            safe_filename = self.sanitize_filename(file_name)
            if not safe_filename.endswith('.md'):
                safe_filename += '.md'
            
            full_path = os.path.join(output_path, safe_filename)
            
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"Downloaded: {safe_filename}")
            return True
            
        except Exception as e:
            print(f"Error downloading '{file_name}': {e}")
            return False
    
    def download_regular_file(self, file_id: str, file_name: str, output_path: str, mime_type: str) -> bool:
        """Download a regular file."""
        try:
            request = self.drive_service.files().get_media(fileId=file_id)
            
            file_content = io.BytesIO()
            downloader = MediaIoBaseDownload(file_content, request)
            
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            
            # Determine if we should convert to markdown
            safe_filename = self.sanitize_filename(file_name)
            
            if mime_type in ['text/plain', 'text/markdown'] or file_name.endswith('.md'):
                # Save as markdown
                if not safe_filename.endswith('.md'):
                    safe_filename += '.md'
                content = file_content.getvalue().decode('utf-8')
            elif mime_type == 'text/html':
                # Convert HTML to markdown-like format
                content = file_content.getvalue().decode('utf-8')
                content = self.html_to_markdown(content)
                if not safe_filename.endswith('.md'):
                    safe_filename += '.md'
            else:
                # Save as original format but note it's not markdown
                content = file_content.getvalue()
                print(f"'{file_name}' is not a text file - saving as original format")
            
            full_path = os.path.join(output_path, safe_filename)
            
            if isinstance(content, str):
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            else:
                with open(full_path, 'wb') as f:
                    f.write(content)
            
            print(f"Downloaded: {safe_filename}")
            return True
            
        except Exception as e:
            print(f"Error downloading '{file_name}': {e}")
            return False
    
    def convert_to_markdown_format(self, content: str) -> str:
        """Convert plain text to basic markdown format."""
        lines = content.split('\n')
        markdown_lines = []
        
        for line in lines:
            line = line.strip()
            if not line:
                markdown_lines.append('')
                continue
            
            # Convert common patterns to markdown
            # Headers (lines that are all caps or start with numbers/bullets)
            if len(line) > 3 and line.isupper():
                markdown_lines.append(f"# {line.title()}")
            elif re.match(r'^\d+\.', line):
                markdown_lines.append(line)  # Keep numbered lists
            elif re.match(r'^[•·*-]\s', line):
                markdown_lines.append(f"- {line[1:].strip()}")  # Convert to markdown bullets
            else:
                markdown_lines.append(line)
        
        return '\n'.join(markdown_lines)
    
    def html_to_markdown(self, html_content: str) -> str:
        """Basic HTML to markdown conversion."""
        # Simple conversions
        content = html_content
        content = re.sub(r'<h1[^>]*>(.*?)</h1>', r'# \1', content, flags=re.DOTALL)
        content = re.sub(r'<h2[^>]*>(.*?)</h2>', r'## \1', content, flags=re.DOTALL)
        content = re.sub(r'<h3[^>]*>(.*?)</h3>', r'### \1', content, flags=re.DOTALL)
        content = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', content, flags=re.DOTALL)
        content = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', content, flags=re.DOTALL)
        content = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', content, flags=re.DOTALL)
        content = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', content, flags=re.DOTALL)
        content = re.sub(r'<a[^>]*href=["\']([^"\']*)["\'][^>]*>(.*?)</a>', r'[\2](\1)', content, flags=re.DOTALL)
        content = re.sub(r'<br[^>]*>', '\n', content)
        content = re.sub(r'<p[^>]*>', '', content)
        content = re.sub(r'</p>', '\n\n', content)
        
        # Remove remaining HTML tags
        content = re.sub(r'<[^>]+>', '', content)
        
        # Clean up extra whitespace
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        return content.strip()
    
    def download_folder_as_markdown(self, folder_id: str, output_directory: str, folder_name: str = None) -> Dict[str, int]:
        """Download all files in a folder as markdown."""
        stats = {'downloaded': 0, 'failed': 0, 'skipped': 0}
        
        # Create output directory
        if folder_name:
            safe_folder_name = self.sanitize_filename(folder_name)
            output_path = os.path.join(output_directory, safe_folder_name)
        else:
            output_path = output_directory
            
        os.makedirs(output_path, exist_ok=True)
        print(f"Created directory: {output_path}")
        
        # Get folder contents
        items = self.get_folder_contents(folder_id)
        
        if not items:
            print("Folder is empty or inaccessible")
            return stats
        
        print(f"Found {len(items)} items in folder")
        
        for item in items:
            file_name = item['name']
            file_id = item['id']
            mime_type = item['mimeType']
            
            # Skip folders (could add recursive option later)
            if mime_type == 'application/vnd.google-apps.folder':
                print(f"Skipping subfolder: {file_name}")
                stats['skipped'] += 1
                continue
            
            # Download based on file type
            if mime_type == 'application/vnd.google-apps.document':
                # Google Doc
                if self.download_google_doc_as_markdown(file_id, file_name, output_path):
                    stats['downloaded'] += 1
                else:
                    stats['failed'] += 1
            elif mime_type in [
                'text/plain', 
                'text/markdown', 
                'text/html',
                'application/rtf'
            ]:
                # Text-based files
                if self.download_regular_file(file_id, file_name, output_path, mime_type):
                    stats['downloaded'] += 1
                else:
                    stats['failed'] += 1
            else:
                # Skip binary files
                print(f"Skipping non-text file: {file_name} ({mime_type})")
                stats['skipped'] += 1
        
        return stats
    
    def interactive_folder_selection(self) -> Optional[str]:
        """Interactive folder selection."""
        print("\nSearching for folders...")
        
        # First, show root level folders
        root_folders = self.list_folders()
        
        if not root_folders:
            print("No folders found in your Drive")
            return None
        
        print("\nAvailable folders:")
        for i, folder in enumerate(root_folders, 1):
            print(f"{i:2d}. {folder['name']}")
        
        # Option to search by name
        print(f"{len(root_folders) + 1:2d}. Search for folder by name")
        print(f"{len(root_folders) + 2:2d}. Enter folder ID directly")
        
        try:
            choice = input(f"\nSelect folder (1-{len(root_folders) + 2}): ").strip()
            
            if choice.isdigit():
                choice_num = int(choice)
                if 1 <= choice_num <= len(root_folders):
                    selected_folder = root_folders[choice_num - 1]
                    return selected_folder['id']
                elif choice_num == len(root_folders) + 1:
                    # Search by name
                    search_name = input("Enter folder name to search: ").strip()
                    folder_id = self.find_folder_by_name(search_name)
                    if folder_id:
                        print(f"Found folder: {search_name}")
                        return folder_id
                    else:
                        print(f"Folder '{search_name}' not found")
                        return None
                elif choice_num == len(root_folders) + 2:
                    # Direct ID entry
                    folder_id = input("Enter folder ID: ").strip()
                    return folder_id if folder_id else None
            
            print("Invalid selection")
            return None
            
        except ValueError:
            print("Invalid input")
            return None

def main():
    """Main function."""
    print("Google Drive Folder to Markdown Downloader")
    print("=" * 50)
    
    # Predefined folder ID and output directory
    FOLDER_ID = "1e6HuzV17XhxKsgRjQ5Ey0y-CFKNiMhj1"
    OUTPUT_DIR = "./markdowns/"
    
    # Check for credentials
    credentials_file = '../../keys/sequoia_credentials.json'
    if not os.path.exists(credentials_file):
        print(f"ERROR: {credentials_file} not found")
        print("\nSetup Instructions:")
        print("1. Go to https://console.cloud.google.com/")
        print("2. Create a new project or select existing")
        print("3. Enable Google Drive API")
        print("4. Create credentials (OAuth 2.0)")
        print("5. Download as credentials.json")
        return
    
    try:
        # Initialize downloader
        print("Connecting to Google Drive...")
        downloader = DriveToMarkdownDownloader(credentials_file)
        
        print(f"Target folder ID: {FOLDER_ID}")
        print(f"Output directory: {OUTPUT_DIR}")
        
        # Create output directory if it doesn't exist
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # Download folder
        print(f"\nStarting download from specified folder...")
        stats = downloader.download_folder_as_markdown(
            FOLDER_ID, 
            OUTPUT_DIR
        )
        
        # Show results
        print(f"\nDownload Complete!")
        print(f"Results:")
        print(f"   Downloaded: {stats['downloaded']} files")
        print(f"   Failed: {stats['failed']} files")
        print(f"   Skipped: {stats['skipped']} files")
        print(f"All files saved to: {os.path.abspath(OUTPUT_DIR)}")
        
        # Show what was downloaded
        if stats['downloaded'] > 0:
            print(f"\nDownloaded files:")
            for file in os.listdir(OUTPUT_DIR):
                if file.endswith('.md'):
                    print(f"   - {file}")
        
    except Exception as e:
        print(f"Error: {e}")
        raise

if __name__ == "__main__":
    main()