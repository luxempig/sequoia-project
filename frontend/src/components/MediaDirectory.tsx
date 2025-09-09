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
  const [s3Structure, setS3Structure] = useState<Record<string, FileItem[]>>({});


  useEffect(() => {
    const loadS3Structure = async () => {
      try {
        const response = await fetch('/api/curator/s3-structure');
        if (response.ok) {
          const data = await response.json();
          setS3Structure(data.structure);
        } else {
          console.error('Failed to load S3 structure');
          // Use fallback structure
          setS3Structure({
            '/': [{ name: 'media', type: 'folder' }],
            '/media/': [
              { name: 'roosevelt-franklin', type: 'folder' },
              { name: 'truman-harry', type: 'folder' }
            ]
          });
        }
      } catch (error) {
        console.error('Error loading S3 structure:', error);
        // Use minimal fallback
        setS3Structure({
          '/': [{ name: 'media', type: 'folder' }]
        });
      }
    };

    loadS3Structure();
  }, []);

  useEffect(() => {
    const loadDirectory = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const directoryItems = s3Structure[currentPath] || [];
      setItems(directoryItems);
      setLoading(false);
    };

    if (Object.keys(s3Structure).length > 0) {
      loadDirectory();
    }
  }, [currentPath, s3Structure]);

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
    // Show loading indicator
    const loadingToast = document.createElement('div');
    loadingToast.className = 'fixed top-4 right-4 bg-blue-100 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg z-50';
    loadingToast.textContent = `Opening ${item.name}...`;
    document.body.appendChild(loadingToast);

    try {
      const presignedUrl = await getPresignedUrl(item.s3Url!);
      
      // Remove loading indicator
      document.body.removeChild(loadingToast);
      
      // Open in new tab for viewing
      window.open(presignedUrl, '_blank');
      
      // Show success message
      const successToast = document.createElement('div');
      successToast.className = 'fixed top-4 right-4 bg-green-100 border border-green-200 text-green-800 px-4 py-2 rounded-lg z-50';
      successToast.textContent = `Opened ${item.name}`;
      document.body.appendChild(successToast);
      setTimeout(() => {
        if (document.body.contains(successToast)) {
          document.body.removeChild(successToast);
        }
      }, 3000);
      
    } catch (error) {
      // Remove loading indicator
      if (document.body.contains(loadingToast)) {
        document.body.removeChild(loadingToast);
      }
      
      console.error('Failed to open file:', error);
      
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'fixed top-4 right-4 bg-red-100 border border-red-200 text-red-800 px-4 py-2 rounded-lg z-50';
      errorToast.textContent = `Failed to open ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      document.body.appendChild(errorToast);
      setTimeout(() => {
        if (document.body.contains(errorToast)) {
          document.body.removeChild(errorToast);
        }
      }, 5000);
    }
  };

  const getPresignedUrl = async (s3Url: string): Promise<string> => {
    try {
      const response = await fetch('/api/curator/presign-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3_url: s3Url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.presigned_url;
    } catch (error) {
      console.error('Failed to get presigned URL:', error);
      throw error;
    }
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
              Live S3 bucket contents from sequoia-canonical 
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Current path: {currentPath} | Items: {items.length} | Loaded: {Object.keys(s3Structure).length} directories
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