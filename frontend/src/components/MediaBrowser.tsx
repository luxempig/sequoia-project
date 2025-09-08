import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from './Layout';
import { api } from '../api';

const MediaBrowser: React.FC = () => {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [filteredMedia, setFilteredMedia] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [mediaData, statsData] = await Promise.all([
          api.get('/api/media?limit=500&presign=true'),
          api.get('/api/media/types/stats')
        ]);
        setMedia(mediaData);
        setFilteredMedia(mediaData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch media data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let filtered = media;

    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description_markdown?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.credit?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (mediaTypeFilter) {
      filtered = filtered.filter(item => item.media_type === mediaTypeFilter);
    }

    setFilteredMedia(filtered);
  }, [searchQuery, mediaTypeFilter, media]);

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return '📸';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'pdf': return '📄';
      default: return '📎';
    }
  };

  const getMediaTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-green-100 text-green-800';
      case 'video': return 'bg-red-100 text-red-800';
      case 'audio': return 'bg-purple-100 text-purple-800';
      case 'pdf': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading media gallery...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Media Gallery
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Historical photographs, documents, videos, and other media
            </p>
          </div>
        </div>

        {stats && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">📚</div>
              <div className="text-lg font-medium text-gray-900">{stats.total_media}</div>
              <div className="text-sm text-gray-500">Total Items</div>
            </div>
            {stats.by_type?.slice(0, 3).map((type: any) => (
              <div key={type.media_type} className="bg-white overflow-hidden shadow rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">{getMediaTypeIcon(type.media_type)}</div>
                <div className="text-lg font-medium text-gray-900">{type.count}</div>
                <div className="text-sm text-gray-500 capitalize">{type.media_type}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="sm:w-48">
            <select
              value={mediaTypeFilter}
              onChange={(e) => setMediaTypeFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="pdf">Documents</option>
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMedia.map((item) => (
            <div key={item.media_slug} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <Link to={`/media/${item.media_slug}`}>
                <div className="aspect-w-16 aspect-h-12">
                  {item.media_type === 'image' && item.url ? (
                    <img 
                      src={item.url} 
                      alt={item.title}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gray-100">
                      <div className="text-center">
                        <div className="text-4xl mb-2">{getMediaTypeIcon(item.media_type)}</div>
                        <div className="text-sm text-gray-500 capitalize">{item.media_type}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMediaTypeColor(item.media_type)} mb-2`}>
                    {item.media_type}
                  </span>
                  <h3 className="text-sm font-medium text-gray-900 hover:text-indigo-600">
                    {item.title}
                  </h3>
                  {item.date && (
                    <p className="mt-1 text-xs text-gray-500">{item.date}</p>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default MediaBrowser;