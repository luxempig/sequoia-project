import os
import json
import re
import time
from typing import List, Dict, Any
from pathlib import Path
import anthropic
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Google Drive API setup
SCOPES = ['https://www.googleapis.com/auth/drive']

# Rate limiting configuration for Claude Sonnet 4.x
CLAUDE_MODEL = "claude-sonnet-4-20250514"  # Use Claude Sonnet 4
REQUESTS_PER_MINUTE = 45  # Conservative limit (50 max)
TOKENS_PER_MINUTE = 25000  # Conservative limit (30k input max)
REQUEST_INTERVAL = 60 / REQUESTS_PER_MINUTE  # ~1.33 seconds between requests

# Shared email for Drive folder access
SHARED_EMAIL = "anlauriasheehan1@gmail.com"

class PresidentialVoyageProcessor:
    def __init__(self, claude_api_key: str, credentials_file: str = '../../keys/sequoia_credentials.json'):
        self.claude_client = anthropic.Anthropic(api_key=claude_api_key)
        self.credentials_file = credentials_file
        self.drive_service = None
        self.last_request_time = 0
        self.requests_made = 0
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
    
    def wait_for_rate_limit(self):
        """Implement rate limiting to stay within Claude API limits."""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < REQUEST_INTERVAL:
            wait_time = REQUEST_INTERVAL - time_since_last
            print(f"Rate limiting: waiting {wait_time:.1f} seconds...")
            time.sleep(wait_time)
        
        self.last_request_time = time.time()
        self.requests_made += 1
        
        # Reset counter every minute
        if self.requests_made % REQUESTS_PER_MINUTE == 0:
            print(f"Made {self.requests_made} requests so far. Pausing 60s for rate limit reset...")
            time.sleep(60)
        
    def create_consolidated_prompt(self) -> str:
        """Create the consolidated prompt for Claude to process markdown files."""
        return """You are analyzing a timeline document for USS Sequoia voyages under a US President. 

Create a JSON object with the president name as lastname-firstname as the key and then values:
- term_start (from document)
- term_end (from document)  
- info (from document)
- voyages: a list of objects

For voyages, include both actual voyages AND non-voyage things. Each item should have:
- voyage: president key appended with "-{start date or section identifier}"
- start_date, end_date, start_time, end_time (if applicable)
- origin, destination (if applicable)
- passengers: list of objects with name (normalized), full_name, title, role, bio (Wikipedia link if present)
- media: list of objects with media_name (normalized), link, source, date, type (file extension), link_type ("drive", "drop", or "other")
- notes: list of distinct notes including all prose about the voyage/section
- tags: list of keywords that could define the voyage/section
- missing_info: list of values that are blank
- content_type: "voyage" or "non-voyage"

For non-voyage content:
- Include any text sections between voyages (like headers, context, historical background)
- Copy the full text content into the notes array
- Use appropriate tags to categorize the content
- Set content_type to "non-voyage"

Maintain the order of passengers exactly as listed in the document. Convert notes to arrays with distinct, separate notes that capture all prose. For media links, determine link_type based on the URL (Google Drive = "drive", Dropbox = "drop", others = "other").

Provide the complete JSON object following this structure. 

IMPORTANT: Ensure the JSON is valid and properly formatted:
- All strings must be in double quotes
- All objects and arrays must be properly closed with matching brackets
- Use commas between array elements and object properties
- Do not include trailing commas
- Escape special characters in strings (quotes, newlines, etc.)

Return ONLY the JSON object, no other text or markdown formatting."""

    def create_markdown_script_prompt(self) -> str:
        """Create the prompt for Claude to generate the markdown conversion script."""
        return """Create a Python script that converts the JSON timeline data into a well-formatted markdown file suitable for Google Docs. The script should:

1. Handle both "voyage" and "non-voyage" content types appropriately
2. Create clear section headers for different content types
3. Format dates and times for readability
4. Create numbered participant lists with Wikipedia links
5. Present notes as organized bullet points
6. Group and format media sources by type
7. Include a table of contents
8. Generate clean, professional markdown without emojis
9. Handle missing information gracefully
10. Create summary statistics

The output should be professional and suitable for historical documentation. Include proper error handling and the ability to process the JSON structure we've been working with.

Provide the complete, working Python script."""

    def extract_president_name(self, markdown_content: str) -> str:
        """Extract president name from markdown content."""
        # Look for common patterns in presidential timeline documents
        patterns = [
            r'President\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)',
            r'# \*\*President\s+([^(]+)',
            r'##?\s*([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s*\(',
            r'([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s*\(.*POTUS',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, markdown_content)
            if match:
                name = match.group(1).strip()
                # Convert to lastname-firstname format
                parts = name.split()
                if len(parts) >= 2:
                    # Handle middle initials
                    if len(parts) == 3 and len(parts[1]) <= 2:  # Middle initial
                        return f"{parts[-1].lower()}-{parts[0].lower()}-{parts[1].lower().replace('.', '')}"
                    else:
                        return f"{parts[-1].lower()}-{parts[0].lower()}"
        
        return "unknown-president"

    def process_markdown_with_claude(self, markdown_content: str) -> Dict[str, Any]:
        """Send markdown content to Claude for JSON conversion."""
        # Implement rate limiting
        self.wait_for_rate_limit()
        
        prompt = f"{self.create_consolidated_prompt()}\n\nHere is the markdown document to analyze:\n\n{markdown_content}"
        
        # Estimate token count (rough approximation: 4 chars per token)
        estimated_tokens = len(prompt) // 4
        print(f"Estimated input tokens: {estimated_tokens:,}")
        
        try:
            print("Sending request to Claude Sonnet 4.x...")
            response = self.claude_client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=4000,  # Reduced to stay within output limits
                system="You are a JSON data processor. CRITICAL: Return only valid, properly formatted JSON with no additional text, markdown formatting, or code blocks.",
                messages=[{
                    "role": "user", 
                    "content": f"{prompt}\n\nIMPORTANT: Respond with ONLY the JSON object. No explanation, no markdown formatting, no code blocks."
                }]
            )
            
            # Extract JSON from response
            content = response.content[0].text
            
            # Try to find JSON in the response
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError as e:
                    print(f"JSON parsing error: {e}")
                    print(f"JSON content preview: {json_str[:500]}...")
                    
                    # Try multiple JSON fixes
                    try:
                        fixed_json = json_str
                        
                        # Fix 1: Remove trailing commas
                        fixed_json = re.sub(r',(\s*[}\]])', r'\1', fixed_json)
                        
                        # Fix 2: Add missing commas between objects/arrays
                        fixed_json = re.sub(r'}\s*{', '},{', fixed_json)
                        fixed_json = re.sub(r']\s*{', '],{', fixed_json) 
                        fixed_json = re.sub(r'}\s*\[', '},[', fixed_json)
                        
                        # Fix 3: Escape unescaped quotes in strings
                        # This is more complex, but try basic fixes
                        
                        # Fix 4: Handle incomplete JSON - try to close it
                        if fixed_json.count('{') > fixed_json.count('}'):
                            fixed_json += '}' * (fixed_json.count('{') - fixed_json.count('}'))
                        if fixed_json.count('[') > fixed_json.count(']'):
                            fixed_json += ']' * (fixed_json.count('[') - fixed_json.count(']'))
                        
                        return json.loads(fixed_json)
                    except Exception as fix_error:
                        print(f"Failed to auto-fix JSON: {fix_error}")
                        print("Trying fallback JSON structure...")
                        
                        # Fallback: Create minimal valid JSON
                        fallback_json = {
                            "error": "JSON parsing failed",
                            "original_error": str(e),
                            "file_processed": True,
                            "fallback_structure": True
                        }
                        return fallback_json
            else:
                raise ValueError("No valid JSON found in Claude's response")
                
        except Exception as e:
            print(f"Error processing with Claude: {e}")
            return {}

    def generate_markdown_script_with_claude(self) -> str:
        """Get Claude to generate the markdown conversion script."""
        # Implement rate limiting
        self.wait_for_rate_limit()
        
        prompt = self.create_markdown_script_prompt()
        estimated_tokens = len(prompt) // 4
        print(f"Estimated input tokens for script generation: {estimated_tokens:,}")
        
        try:
            print("Generating markdown conversion script with Claude Sonnet 4.x...")
            response = self.claude_client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=4000,  # Reduced to stay within output limits
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            content = response.content[0].text
            
            # Extract Python code from response
            if "```python" in content:
                start = content.find("```python") + 9
                end = content.find("```", start)
                return content[start:end].strip()
            elif "```" in content:
                start = content.find("```") + 3
                end = content.find("```", start)
                return content[start:end].strip()
            else:
                return content
                
        except Exception as e:
            print(f"Error generating script with Claude: {e}")
            return ""

    def create_or_find_drive_folder(self, folder_name: str, parent_folder_name: str = "Presidential Voyages") -> str:
        """Create or find a folder in Google Drive."""
        try:
            # First, find or create the parent folder
            parent_query = f"name='{parent_folder_name}' and mimeType='application/vnd.google-apps.folder'"
            parent_results = self.drive_service.files().list(q=parent_query).execute()
            parent_items = parent_results.get('files', [])
            
            if not parent_items:
                # Create parent folder
                parent_metadata = {
                    'name': parent_folder_name,
                    'mimeType': 'application/vnd.google-apps.folder'
                }
                parent_folder = self.drive_service.files().create(body=parent_metadata).execute()
                parent_folder_id = parent_folder.get('id')
                print(f"Created parent folder: {parent_folder_name}")
            else:
                parent_folder_id = parent_items[0]['id']
                print(f"Found existing parent folder: {parent_folder_name}")
            
            # Now find or create the president-specific folder
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and '{parent_folder_id}' in parents"
            results = self.drive_service.files().list(q=query).execute()
            items = results.get('files', [])
            
            if not items:
                # Create the folder
                folder_metadata = {
                    'name': folder_name,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [parent_folder_id]
                }
                folder = self.drive_service.files().create(body=folder_metadata).execute()
                folder_id = folder.get('id')
                print(f"Created folder: {folder_name}")
            else:
                folder_id = items[0]['id']
                print(f"Found existing folder: {folder_name}")
            
            # Share the folder with the specified email
            self.share_drive_folder(folder_id, SHARED_EMAIL)
            
            return folder_id
            
        except Exception as e:
            print(f"Error creating/finding Drive folder: {e}")
            return ""

    def share_drive_folder(self, folder_id: str, email: str, role: str = 'writer') -> bool:
        """Share a Drive folder with the specified email."""
        try:
            permission = {
                'type': 'user',
                'role': role,  # 'reader', 'writer', or 'owner'
                'emailAddress': email
            }
            
            result = self.drive_service.permissions().create(
                fileId=folder_id,
                body=permission,
                sendNotificationEmail=True,
                emailMessage=f"Shared folder containing processed USS Sequoia presidential timeline data."
            ).execute()
            
            print(f"Successfully shared folder with {email}")
            return True
            
        except Exception as e:
            print(f"Warning: Could not share folder with {email}: {e}")
            return False

    def upload_file_to_drive(self, file_path: str, folder_id: str, file_name: str = None) -> str:
        """Upload a file to Google Drive."""
        try:
            if not file_name:
                file_name = os.path.basename(file_path)
            
            # Determine MIME type
            if file_path.endswith('.json'):
                mime_type = 'application/json'
            elif file_path.endswith('.md'):
                mime_type = 'text/markdown'
            else:
                mime_type = 'text/plain'
            
            file_metadata = {
                'name': file_name,
                'parents': [folder_id]
            }
            
            media = MediaFileUpload(file_path, mimetype=mime_type)
            file = self.drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            
            print(f"Uploaded {file_name} to Drive")
            return file.get('id')
            
        except Exception as e:
            if "storageQuotaExceeded" in str(e) or "Service Accounts do not have storage quota" in str(e):
                print(f"WARNING: Service account storage quota exceeded for {file_name}")
                print("File saved locally - manual upload to Drive required")
                return "quota_exceeded"
            else:
                print(f"Error uploading file to Drive: {e}")
                return ""

    def process_markdown_file(self, markdown_file_path: str) -> bool:
        """Process a single markdown file through the complete pipeline."""
        try:
            print(f"\nProcessing: {markdown_file_path}")
            
            # Read markdown file
            with open(markdown_file_path, 'r', encoding='utf-8') as f:
                markdown_content = f.read()
            
            # Extract president name
            president_name = self.extract_president_name(markdown_content)
            print(f"Detected president: {president_name}")
            
            # Process with Claude to get JSON
            print("Processing markdown with Claude...")
            json_data = self.process_markdown_with_claude(markdown_content)
            
            if not json_data:
                print("Failed to get valid JSON from Claude")
                return False
            
            # Create local directory for output
            output_dir = f"output_{president_name}"
            os.makedirs(output_dir, exist_ok=True)
            
            # Save JSON file
            json_file_path = os.path.join(output_dir, f"{president_name}_voyages.json")
            with open(json_file_path, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)
            print(f"Saved JSON: {json_file_path}")
            
            # Generate markdown conversion script
            print("Generating markdown conversion script with Claude...")
            script_content = self.generate_markdown_script_with_claude()
            
            if not script_content:
                print("Failed to generate markdown script")
                return False
            
            # Save and execute the script
            script_file_path = os.path.join(output_dir, "convert_to_markdown.py")
            with open(script_file_path, 'w', encoding='utf-8') as f:
                f.write(script_content)
            
            # Execute the script to create markdown
            print("Executing markdown conversion script...")
            try:
                # Create a modified version of the script that works with our JSON
                exec_script = script_content.replace(
                    'input_file = "sequoia_voyages.json"',
                    f'input_file = "{json_file_path}"'
                ).replace(
                    'output_file = "uss_sequoia_timeline.md"',
                    f'output_file = "{os.path.join(output_dir, f"{president_name}_timeline.md")}"'
                )
                
                # Execute the script
                exec(exec_script)
                
                markdown_file_path = os.path.join(output_dir, f"{president_name}_timeline.md")
                print(f"Created markdown: {markdown_file_path}")
                
            except Exception as e:
                print(f"Error executing markdown script: {e}")
                # Create a simple fallback markdown
                markdown_file_path = os.path.join(output_dir, f"{president_name}_timeline.md")
                with open(markdown_file_path, 'w', encoding='utf-8') as f:
                    f.write(f"# {president_name.replace('-', ' ').title()} Voyages\n\n")
                    f.write(f"JSON data processed but markdown conversion failed.\n\n")
                    f.write(f"See {president_name}_voyages.json for complete data.\n")
            
            # Upload to Google Drive
            print("Uploading to Google Drive...")
            folder_name = president_name.replace('-', '_').title()
            drive_folder_id = self.create_or_find_drive_folder(folder_name)
            
            if drive_folder_id:
                # Upload JSON
                self.upload_file_to_drive(json_file_path, drive_folder_id)
                
                # Upload markdown
                if os.path.exists(markdown_file_path):
                    self.upload_file_to_drive(markdown_file_path, drive_folder_id)
                
                # Upload original markdown for reference
                original_name = f"original_{os.path.basename(markdown_file_path.replace('_timeline', '_source'))}"
                with open(os.path.join(output_dir, original_name), 'w', encoding='utf-8') as f:
                    f.write(markdown_content)
                self.upload_file_to_drive(os.path.join(output_dir, original_name), drive_folder_id)
                
                print(f"Successfully uploaded files to Drive folder: {folder_name}")
            
            return True
            
        except Exception as e:
            print(f"Error processing {markdown_file_path}: {e}")
            return False

    def process_markdown_files(self, markdown_files: List[str]) -> None:
        """Process a list of markdown files with rate limiting optimization."""
        print(f"Starting processing of {len(markdown_files)} markdown files...")
        print(f"Rate limiting: ~{REQUEST_INTERVAL:.1f}s between requests")
        print(f"Estimated total time: {len(markdown_files) * REQUEST_INTERVAL * 2 / 60:.1f} minutes")
        print("(2 requests per file: JSON conversion + script generation)\n")
        
        successful = 0
        failed = 0
        start_time = time.time()
        
        for i, file_path in enumerate(markdown_files, 1):
            print(f"\n--- Processing file {i}/{len(markdown_files)}: {file_path} ---")
            
            try:
                if self.process_markdown_file(file_path):
                    successful += 1
                    print(f"Successfully processed {file_path}")
                else:
                    failed += 1
                    print(f"Failed to process {file_path}")
                    
            except Exception as e:
                failed += 1
                print(f"Error processing {file_path}: {e}")
            
            # Progress update
            elapsed = time.time() - start_time
            avg_time_per_file = elapsed / i
            remaining_files = len(markdown_files) - i
            eta_minutes = (remaining_files * avg_time_per_file) / 60
            
            if remaining_files > 0:
                print(f"Progress: {i}/{len(markdown_files)} files | ETA: {eta_minutes:.1f} minutes")
        
        total_time = time.time() - start_time
        print(f"\n=== Processing Complete ===")
        print(f"Successful: {successful}")
        print(f"Failed: {failed}")
        print(f"Total: {len(markdown_files)}")
        print(f"Total time: {total_time / 60:.1f} minutes")
        print(f"All folders shared with: {SHARED_EMAIL}")

def main():
    """Main function to run the processor."""
    
    # Configuration
    CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')
    
    if not CLAUDE_API_KEY:
        print("Error: Please set CLAUDE_API_KEY environment variable")
        print("You can set it by running: export CLAUDE_API_KEY='your-api-key-here'")
        return
    
    # Google Drive credentials file (download from Google Cloud Console)
    CREDENTIALS_FILE = '../../keys/sequoia_credentials.json'
    
    if not os.path.exists(CREDENTIALS_FILE):
        print(f"Error: {CREDENTIALS_FILE} not found")
        print("Please ensure the service account credentials file exists")
        return
    
    # Look for markdown files in markdowns directory
    markdown_files = [str(f) for f in Path('./markdowns').glob('*.md')]
    
    if not markdown_files:
        print("No markdown files found in markdowns directory.")
        print("Please place your markdown files in the markdowns directory.")
        print("Supported pattern: *.md")
        return
    
    print(f"Found {len(markdown_files)} markdown files:")
    for i, file in enumerate(markdown_files, 1):
        print(f"  {i}. {file}")
    
    # Auto-confirm processing (skip user input for automation)
    print("\nProcessing all files...")
    # response = input("\nProcess all these files? (y/n): ")
    # if response.lower() != 'y':
    #     print("Processing cancelled.")
    #     return
    
    # Initialize processor
    try:
        processor = PresidentialVoyageProcessor(CLAUDE_API_KEY, CREDENTIALS_FILE)
        
        # Process all files
        processor.process_markdown_files(markdown_files)
        
    except Exception as e:
        print(f"Error initializing processor: {e}")

if __name__ == "__main__":
    main()