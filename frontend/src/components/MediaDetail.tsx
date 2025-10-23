import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from './Layout';
import { api } from '../api';

const MediaDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [media, setMedia] = useState<any>(null);
  const [relatedVoyages, setRelatedVoyages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'db' | 's3' | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) return;

      try {
        setLoading(true);
        const [mediaData, voyagesData] = await Promise.all([
          api.getMedia(slug, true),
          api.getMediaRelatedVoyages(slug)
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

  const handleDelete = async (deleteFromS3: boolean) => {
    if (!slug) return;

    setDeleting(true);
    try {
      const url = deleteFromS3
        ? `/api/curator/media/${slug}?delete_from_s3=true`
        : `/api/curator/media/${slug}`;

      const response = await fetch(url, { method: 'DELETE' });

      if (response.ok) {
        // Redirect to media gallery
        window.location.href = '/media-explorer';
      } else {
        console.error('Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'article': return '📄';
      case 'document': return '📃';
      case 'logbook': return '📓';
      case 'image': return '📸';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'book': return '📚';
      case 'pdf': return '📄'; // Legacy support
      default: return '📎';
    }
  };

  const getMediaTypeColor = (type: string) => {
    switch (type) {
      case 'article': return 'bg-blue-100 text-blue-800';
      case 'document': return 'bg-purple-100 text-purple-800';
      case 'logbook': return 'bg-amber-100 text-amber-800';
      case 'image': return 'bg-green-100 text-green-800';
      case 'video': return 'bg-red-100 text-red-800';
      case 'audio': return 'bg-purple-100 text-purple-800';
      case 'book': return 'bg-yellow-100 text-yellow-800';
      case 'pdf': return 'bg-blue-100 text-blue-800'; // Legacy support
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
              {media.media_type === 'image' && (media.s3_url || media.url) ? (
                <img
                  src={media.s3_url || media.url}
                  alt={media.title}
                  className="w-full max-h-96 object-contain bg-gray-50"
                />
              ) : media.media_type === 'video' && (media.s3_url || media.url) ? (
                <video
                  controls
                  className="w-full max-h-96 bg-black"
                  poster={media.public_derivative_url}
                >
                  <source src={media.s3_url || media.url} />
                  Your browser does not support the video tag.
                </video>
              ) : media.media_type === 'audio' && (media.s3_url || media.url) ? (
                <div className="p-8 text-center bg-gray-50">
                  <div className="text-6xl mb-4">🎵</div>
                  <audio controls className="w-full max-w-md mx-auto">
                    <source src={media.s3_url || media.url} />
                    Your browser does not support the audio tag.
                  </audio>
                </div>
              ) : (
                <div className="p-12 text-center bg-gray-50">
                  <div className="text-6xl mb-4">{getMediaTypeIcon(media.media_type)}</div>
                  <p className="text-gray-600">Preview not available</p>
                  {(media.s3_url || media.url) && (
                    <a
                      href={media.s3_url || media.url}
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
              {(media.s3_url || media.url) && (
                <a
                  href={media.s3_url || media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                >
                  View Original
                </a>
              )}
              {media.public_derivative_url && media.public_derivative_url !== (media.s3_url || media.url) && (
                <a
                  href={media.public_derivative_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200"
                >
                  Thumbnail
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

              {/* Delete Actions */}
              <div className="px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm('db')}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    🗃️ Delete from Database
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm('s3')}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    🗑️ Delete from Media Library & Database
                  </button>
                </div>
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

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed z-50 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowDeleteConfirm(null)}></div>

              <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 shadow-xl max-w-lg w-full">
                <div className="sm:flex sm:items-start">
                  <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${showDeleteConfirm === 's3' ? 'bg-red-100' : 'bg-orange-100'}`}>
                    <span className="text-2xl">{showDeleteConfirm === 's3' ? '⚠️' : 'ℹ️'}</span>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {showDeleteConfirm === 's3' ? 'Delete from Media Library & Database?' : 'Delete from Database?'}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {showDeleteConfirm === 's3'
                          ? 'This will permanently delete the file from S3 storage and remove all database records. This action cannot be undone.'
                          : 'This will detach from all voyages but file will still be found in media explorer.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    onClick={() => handleDelete(showDeleteConfirm === 's3')}
                    disabled={deleting}
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${
                      showDeleteConfirm === 's3'
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                        : 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
                    } ${deleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    disabled={deleting}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MediaDetail;