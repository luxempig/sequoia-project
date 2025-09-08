import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from './Layout';
import { api } from '../api';

const MediaDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [media, setMedia] = useState<any>(null);
  const [relatedVoyages, setRelatedVoyages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        const [mediaData, voyagesData] = await Promise.all([
          api.get(`/api/media/${slug}?presign=true`),
          api.get(`/api/media/${slug}/related-voyages`)
        ]);
        setMedia(mediaData);
        setRelatedVoyages(voyagesData);
      } catch (error) {
        console.error('Failed to fetch media:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

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
            <p className="mt-2 text-gray-600">Loading media details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!media || Object.keys(media).length === 0) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-4xl">❓</span>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Media not found</h3>
            <p className="mt-1 text-sm text-gray-500">
              The media you're looking for doesn't exist or has been removed.
            </p>
            <Link 
              to="/media" 
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Back to Media Gallery
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link to="/media" className="text-gray-400 hover:text-gray-500">
                  Media Gallery
                </Link>
              </li>
              <li className="flex items-center">
                <span className="text-gray-400 mx-2">/</span>
                <span className="text-sm font-medium text-gray-500">{media.title}</span>
              </li>
            </ol>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Media Display */}
          <div>
            <div className="bg-white shadow-lg rounded-lg overflow-hidden">
              {media.media_type === 'image' && media.url ? (
                <img 
                  src={media.url} 
                  alt={media.title}
                  className="w-full max-h-96 object-contain bg-gray-50"
                />
              ) : media.media_type === 'video' && media.url ? (
                <video 
                  controls 
                  className="w-full max-h-96 bg-black"
                  poster={media.public_derivative_url}
                >
                  <source src={media.url} />
                  Your browser does not support the video tag.
                </video>
              ) : media.media_type === 'audio' && media.url ? (
                <div className="p-8 text-center bg-gray-50">
                  <div className="text-6xl mb-4">🎵</div>
                  <audio controls className="w-full max-w-md mx-auto">
                    <source src={media.url} />
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              ) : (
                <div className="p-12 text-center bg-gray-50">
                  <div className="text-6xl mb-4">{getMediaTypeIcon(media.media_type)}</div>
                  <p className="text-gray-600">Preview not available</p>
                  {media.url && (
                    <a 
                      href={media.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Open Original
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Download/External Links */}
            <div className="mt-4 flex flex-wrap gap-2">
              {media.url && (
                <a 
                  href={media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                >
                  View Original
                </a>
              )}
              {media.public_derivative_url && media.public_derivative_url !== media.url && (
                <a 
                  href={media.public_derivative_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200"
                >
                  Public Version
                </a>
              )}
              {media.google_drive_link && (
                <a 
                  href={media.google_drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                >
                  Google Drive
                </a>
              )}
            </div>
          </div>

          {/* Media Info */}
          <div>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{media.title}</h3>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMediaTypeColor(media.media_type)}`}>
                    {getMediaTypeIcon(media.media_type)} {media.media_type}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  {media.date && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Date</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{media.date}</dd>
                    </div>
                  )}
                  {media.credit && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Credit</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{media.credit}</dd>
                    </div>
                  )}
                  {media.description_markdown && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Description</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <div className="prose prose-sm max-w-none">
                          {media.description_markdown.split('\n').map((line: string, index: number) => (
                            <p key={index}>{line}</p>
                          ))}
                        </div>
                      </dd>
                    </div>
                  )}
                  {media.copyright_restrictions && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Copyright</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{media.copyright_restrictions}</dd>
                    </div>
                  )}
                  {media.tags && (
                    <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Tags</dt>
                      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                        <div className="flex flex-wrap gap-1">
                          {media.tags.split(',').map((tag: string, index: number) => (
                            <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Related Voyages */}
            {relatedVoyages.length > 0 && (
              <div className="mt-6 bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Related Voyages ({relatedVoyages.length})
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Voyages that feature this media
                  </p>
                </div>
                <div className="border-t border-gray-200">
                  <div className="divide-y divide-gray-200">
                    {relatedVoyages.map((voyage, index) => (
                      <div key={voyage.voyage_slug} className="px-4 py-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Link 
                              to={`/voyages/${voyage.voyage_slug}`}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              {voyage.title}
                            </Link>
                            <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                              <span>{voyage.start_date}</span>
                              {voyage.end_date && voyage.end_date !== voyage.start_date && (
                                <>
                                  <span>→</span>
                                  <span>{voyage.end_date}</span>
                                </>
                              )}
                              {voyage.president_name && (
                                <>
                                  <span>•</span>
                                  <span>{voyage.president_name}</span>
                                  {voyage.president_party && (
                                    <span className="text-gray-400">({voyage.president_party})</span>
                                  )}
                                </>
                              )}
                            </div>
                            {voyage.voyage_media_notes && (
                              <p className="mt-2 text-sm text-gray-600">{voyage.voyage_media_notes}</p>
                            )}
                          </div>
                          {voyage.sort_order && (
                            <div className="ml-4 flex-shrink-0">
                              <span className="text-xs text-gray-400">#{voyage.sort_order}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MediaDetail;