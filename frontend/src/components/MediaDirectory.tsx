import React, { useState, useEffect } from 'react';
import Layout from './Layout';

interface FileItem {
  name: string;
  type: 'folder' | 'file';
  size?: string;
  lastModified?: string;
  extension?: string;
  s3Url?: string;
}

const MediaDirectory: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Real S3 structure: media/{president_slug}/{source_slug}/{voyage_slug}/{extension}/{media_slug}.{extension}
  const realS3Structure: Record<string, FileItem[]> = {
    '/': [
      { name: 'media', type: 'folder' },
    ],
    '/media/': [
      { name: 'roosevelt-franklin', type: 'folder' },
      { name: 'truman-harry', type: 'folder' },
      { name: 'eisenhower-dwight', type: 'folder' },
      { name: 'kennedy-john', type: 'folder' },
      { name: 'johnson-lyndon', type: 'folder' },
      { name: 'nixon-richard', type: 'folder' },
      { name: 'ford-gerald', type: 'folder' },
      { name: 'carter-jimmy', type: 'folder' },
    ],
    '/media/roosevelt-franklin/': [
      { name: 'sequoia-logbook', type: 'folder' },
      { name: 'fdr-day-by-day', type: 'folder' },
      { name: 'philadelphia-inquirer', type: 'folder' },
      { name: 'baltimore-sun', type: 'folder' },
      { name: 'los-angeles-times', type: 'folder' },
    ],
    '/media/roosevelt-franklin/sequoia-logbook/': [
      { name: 'voyage-henry-roosevelt-1933-04-21', type: 'folder' },
      { name: 'voyage-war-debts-discussion-1933-04-23', type: 'folder' },
      { name: 'voyage-eleanor-todhunter-1933-04-30', type: 'folder' },
    ],
    '/media/roosevelt-franklin/sequoia-logbook/voyage-henry-roosevelt-1933-04-21/': [
      { name: 'pdf', type: 'folder' },
      { name: 'jpg', type: 'folder' },
    ],
    '/media/roosevelt-franklin/sequoia-logbook/voyage-henry-roosevelt-1933-04-21/pdf/': [
      { name: 'logbook-page-5.pdf', type: 'file', size: '2.1 MB', lastModified: '2024-01-15', extension: 'pdf', s3Url: 'media/roosevelt-franklin/sequoia-logbook/voyage-henry-roosevelt-1933-04-21/pdf/logbook-page-5.pdf' },
    ],
    '/media/roosevelt-franklin/sequoia-logbook/voyage-henry-roosevelt-1933-04-21/jpg/': [
      { name: 'logbook-page-5_thumb.jpg', type: 'file', size: '156 KB', lastModified: '2024-01-15', extension: 'jpg', s3Url: 'media/roosevelt-franklin/sequoia-logbook/voyage-henry-roosevelt-1933-04-21/jpg/logbook-page-5_thumb.jpg' },
      { name: 'logbook-page-5_preview.jpg', type: 'file', size: '485 KB', lastModified: '2024-01-15', extension: 'jpg', s3Url: 'media/roosevelt-franklin/sequoia-logbook/voyage-henry-roosevelt-1933-04-21/jpg/logbook-page-5_preview.jpg' },
    ],
    '/media/roosevelt-franklin/sequoia-logbook/voyage-war-debts-discussion-1933-04-23/': [
      { name: 'pdf', type: 'folder' },
      { name: 'jpg', type: 'folder' },
    ],
    '/media/roosevelt-franklin/sequoia-logbook/voyage-war-debts-discussion-1933-04-23/pdf/': [
      { name: 'logbook-page-7.pdf', type: 'file', size: '2.8 MB', lastModified: '2024-01-16', extension: 'pdf', s3Url: 'media/roosevelt-franklin/sequoia-logbook/voyage-war-debts-discussion-1933-04-23/pdf/logbook-page-7.pdf' },
    ],
    '/media/roosevelt-franklin/sequoia-logbook/voyage-war-debts-discussion-1933-04-23/jpg/': [
      { name: 'logbook-page-7_thumb.jpg', type: 'file', size: '167 KB', lastModified: '2024-01-16', extension: 'jpg', s3Url: 'media/roosevelt-franklin/sequoia-logbook/voyage-war-debts-discussion-1933-04-23/jpg/logbook-page-7_thumb.jpg' },
      { name: 'logbook-page-7_preview.jpg', type: 'file', size: '521 KB', lastModified: '2024-01-16', extension: 'jpg', s3Url: 'media/roosevelt-franklin/sequoia-logbook/voyage-war-debts-discussion-1933-04-23/jpg/logbook-page-7_preview.jpg' },
    ],
    '/media/roosevelt-franklin/philadelphia-inquirer/': [
      { name: 'voyage-war-debts-discussion-1933-04-23', type: 'folder' },
    ],
    '/media/roosevelt-franklin/philadelphia-inquirer/voyage-war-debts-discussion-1933-04-23/': [
      { name: 'pdf', type: 'folder' },
      { name: 'jpg', type: 'folder' },
    ],
    '/media/roosevelt-franklin/philadelphia-inquirer/voyage-war-debts-discussion-1933-04-23/pdf/': [
      { name: 'philadelphia-inquirer-full-pg3.pdf', type: 'file', size: '4.2 MB', lastModified: '2024-01-18', extension: 'pdf', s3Url: 'media/roosevelt-franklin/philadelphia-inquirer/voyage-war-debts-discussion-1933-04-23/pdf/philadelphia-inquirer-full-pg3.pdf' },
    ],
    '/media/roosevelt-franklin/philadelphia-inquirer/voyage-war-debts-discussion-1933-04-23/jpg/': [
      { name: 'philadelphia-inquirer-full-pg3_thumb.jpg', type: 'file', size: '198 KB', lastModified: '2024-01-18', extension: 'jpg', s3Url: 'media/roosevelt-franklin/philadelphia-inquirer/voyage-war-debts-discussion-1933-04-23/jpg/philadelphia-inquirer-full-pg3_thumb.jpg' },
      { name: 'philadelphia-inquirer-full-pg3_preview.jpg', type: 'file', size: '654 KB', lastModified: '2024-01-18', extension: 'jpg', s3Url: 'media/roosevelt-franklin/philadelphia-inquirer/voyage-war-debts-discussion-1933-04-23/jpg/philadelphia-inquirer-full-pg3_preview.jpg' },
    ],
    '/media/truman-harry/': [
      { name: 'truman-library', type: 'folder' },
      { name: 'washington-post', type: 'folder' },
    ],
    '/media/truman-harry/truman-library/': [
      { name: 'voyage-potsdam-prep-1945-07-15', type: 'folder' },
    ],
    '/media/eisenhower-dwight/': [
      { name: 'eisenhower-library', type: 'folder' },
      { name: 'life-magazine', type: 'folder' },
    ],
    '/media/kennedy-john/': [
      { name: 'kennedy-library', type: 'folder' },
      { name: 'time-magazine', type: 'folder' },
    ],
  };

  useEffect(() => {
    const loadDirectory = async () => {
      setLoading(true);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const directoryItems = realS3Structure[currentPath] || [];
      setItems(directoryItems);
      setLoading(false);
    };

    loadDirectory();
  }, [currentPath]);

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'folder') {
      const newPath = currentPath === '/' ? `/${item.name}/` : `${currentPath}${item.name}/`;
      navigateToPath(newPath);
    } else if (item.type === 'file' && item.s3Url) {
      // Open file - in real implementation, this would use presigned URLs
      openFile(item);
    }
  };

  const openFile = async (item: FileItem) => {
    try {
      // In real implementation, this would request a presigned URL from the backend
      const presignedUrl = await getPresignedUrl(item.s3Url!);
      
      // Open in new tab for viewing
      window.open(presignedUrl, '_blank');
    } catch (error) {
      console.error('Failed to open file:', error);
      // Fallback: try to construct a public URL or show error
      alert(`Cannot open file: ${item.name}. File access not available in demo mode.`);
    }
  };

  const getPresignedUrl = async (s3Url: string): Promise<string> => {
    // In real implementation, this would call your backend API
    // For demo, we'll simulate the URL generation
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate presigned URL - in reality this would come from your backend
        if (s3Url.includes('.jpg') || s3Url.includes('.png')) {
          resolve(`https://sequoia-canonical.s3.amazonaws.com/${s3Url}?presigned-demo`);
        } else if (s3Url.includes('.pdf')) {
          resolve(`https://sequoia-canonical.s3.amazonaws.com/${s3Url}?presigned-demo`);
        } else {
          reject(new Error('Unsupported file type'));
        }
      }, 500);
    });
  };

  const getBreadcrumbs = () => {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }];
    
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Root', path: '/' }];
    
    let currentBreadcrumbPath = '';
    parts.forEach((part, index) => {
      currentBreadcrumbPath += `/${part}`;
      if (index < parts.length - 1 || currentPath.endsWith('/')) {
        currentBreadcrumbPath += '/';
      }
      breadcrumbs.push({ name: part, path: currentBreadcrumbPath });
    });
    
    return breadcrumbs;
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') return '📁';
    
    switch (item.extension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'mp4':
      case 'avi':
      case 'mov':
        return '🎥';
      case 'mp3':
      case 'wav':
      case 'flac':
        return '🎵';
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      default:
        return '📄';
    }
  };

  const filteredItems = items.filter(item =>
    searchQuery.trim() === '' || 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Media Archive
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Real S3 structure: media/president/source/voyage/extension/file
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Current path: {currentPath} | Items: {items.length}
            </p>
          </div>
        </div>

        {/* Breadcrumbs */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            {getBreadcrumbs().map((crumb, index) => (
              <li key={crumb.path} className="inline-flex items-center">
                {index > 0 && (
                  <span className="mx-2 text-gray-400">/</span>
                )}
                <button
                  onClick={() => navigateToPath(crumb.path)}
                  className={`${
                    crumb.path === currentPath
                      ? 'text-gray-700 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  } text-sm`}
                >
                  {crumb.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Search */}
        <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading directory...</p>
          </div>
        )}

        {/* File List */}
        {!loading && (
          <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between text-sm font-medium text-gray-500">
                <span>Name</span>
                <div className="flex space-x-8">
                  <span>Size</span>
                  <span>Modified</span>
                </div>
              </div>
            </div>
            
            <div className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  {searchQuery ? 'No files match your search.' : 'This directory is empty.'}
                </div>
              ) : (
                filteredItems.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${
                      item.type === 'folder' 
                        ? 'hover:bg-blue-50' 
                        : item.s3Url 
                          ? 'hover:bg-green-50' 
                          : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="text-xl mr-3">{getFileIcon(item)}</span>
                      <span
                        className={`font-medium ${
                          item.type === 'folder' 
                            ? 'text-blue-600' 
                            : item.s3Url 
                              ? 'text-green-600' 
                              : 'text-gray-900'
                        }`}
                      >
                        {item.name}
                        {item.s3Url && (
                          <span className="ml-2 text-xs text-green-500">
                            📂 Click to open
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-8 text-sm text-gray-500">
                      <span className="w-16 text-right">
                        {item.size || (item.type === 'folder' ? '—' : '—')}
                      </span>
                      <span className="w-20 text-right">
                        {item.lastModified || '—'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 text-sm text-gray-500">
          <p>
            Showing {filteredItems.length} items • 
            Folders: {filteredItems.filter(i => i.type === 'folder').length} • 
            Files: {filteredItems.filter(i => i.type === 'file').length}
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default MediaDirectory;