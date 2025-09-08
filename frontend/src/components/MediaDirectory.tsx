import React, { useState, useEffect } from 'react';
import Layout from './Layout';

interface FileItem {
  name: string;
  type: 'folder' | 'file';
  size?: string;
  lastModified?: string;
  extension?: string;
}

const MediaDirectory: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Simulate S3 bucket structure - in real implementation, this would come from your S3 API
  const mockS3Structure: Record<string, FileItem[]> = {
    '/': [
      { name: 'images', type: 'folder' },
      { name: 'documents', type: 'folder' },
      { name: 'videos', type: 'folder' },
      { name: 'audio', type: 'folder' },
      { name: 'manuscripts', type: 'folder' },
    ],
    '/images/': [
      { name: 'presidential-portraits', type: 'folder' },
      { name: 'voyage-photography', type: 'folder' },
      { name: 'deck-plans', type: 'folder' },
      { name: 'guest-photos', type: 'folder' },
    ],
    '/images/presidential-portraits/': [
      { name: 'roosevelt-fdr-1936.jpg', type: 'file', size: '2.4 MB', lastModified: '2024-03-15', extension: 'jpg' },
      { name: 'truman-1948.jpg', type: 'file', size: '1.8 MB', lastModified: '2024-03-12', extension: 'jpg' },
      { name: 'eisenhower-1954.jpg', type: 'file', size: '3.1 MB', lastModified: '2024-03-10', extension: 'jpg' },
      { name: 'kennedy-1962.jpg', type: 'file', size: '2.7 MB', lastModified: '2024-03-08', extension: 'jpg' },
      { name: 'johnson-1965.jpg', type: 'file', size: '2.2 MB', lastModified: '2024-03-05', extension: 'jpg' },
    ],
    '/images/voyage-photography/': [
      { name: '1936-potomac-cruise', type: 'folder' },
      { name: '1945-potsdam-conference', type: 'folder' },
      { name: '1960-camp-david-talks', type: 'folder' },
      { name: 'deck-ceremonies.jpg', type: 'file', size: '4.2 MB', lastModified: '2024-02-28', extension: 'jpg' },
    ],
    '/documents/': [
      { name: 'guest-registers', type: 'folder' },
      { name: 'navigation-logs', type: 'folder' },
      { name: 'maintenance-records', type: 'folder' },
      { name: 'diplomatic-correspondence', type: 'folder' },
    ],
    '/documents/guest-registers/': [
      { name: 'guest-register-1936-1940.pdf', type: 'file', size: '15.6 MB', lastModified: '2024-01-20', extension: 'pdf' },
      { name: 'guest-register-1941-1945.pdf', type: 'file', size: '18.2 MB', lastModified: '2024-01-18', extension: 'pdf' },
      { name: 'guest-register-1946-1950.pdf', type: 'file', size: '14.8 MB', lastModified: '2024-01-15', extension: 'pdf' },
    ],
    '/videos/': [
      { name: 'ceremonial-footage', type: 'folder' },
      { name: 'presidential-arrivals', type: 'folder' },
      { name: 'news-reels', type: 'folder' },
    ],
    '/videos/ceremonial-footage/': [
      { name: 'commissioning-ceremony-1933.mp4', type: 'file', size: '245 MB', lastModified: '2024-02-10', extension: 'mp4' },
      { name: 'presidential-inspection-1936.mp4', type: 'file', size: '180 MB', lastModified: '2024-02-08', extension: 'mp4' },
    ],
    '/audio/': [
      { name: 'radio-transmissions', type: 'folder' },
      { name: 'oral-histories', type: 'folder' },
      { name: 'ceremonial-recordings', type: 'folder' },
    ],
    '/manuscripts/': [
      { name: 'personal-correspondence', type: 'folder' },
      { name: 'official-documents', type: 'folder' },
      { name: 'diary-entries', type: 'folder' },
    ],
  };

  useEffect(() => {
    const loadDirectory = async () => {
      setLoading(true);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const directoryItems = mockS3Structure[currentPath] || [];
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
    }
    // For files, you could open them in a modal or navigate to a detail view
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
              Browse the sequoia-canonical S3 bucket contents
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
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                      item.type === 'folder' ? 'hover:bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="text-xl mr-3">{getFileIcon(item)}</span>
                      <span
                        className={`font-medium ${
                          item.type === 'folder' ? 'text-blue-600' : 'text-gray-900'
                        }`}
                      >
                        {item.name}
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