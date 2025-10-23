import React, { useState, useEffect } from 'react';
import { MediaItem } from '../types';

interface Album {
  album_id: number;
  album_slug: string;
  title: string;
  description?: string;
  voyage_slug: string;
  sort_order: number;
  media_count: number;
  media?: MediaItem[];
}

interface AlbumManagerProps {
  voyageSlug: string;
  media: MediaItem[]; // All media for this voyage
  editMode: boolean;
}

const AlbumManager: React.FC<AlbumManagerProps> = ({ voyageSlug, media, editMode }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);

  // Create album state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');

  // Add media to album state
  const [addingToAlbum, setAddingToAlbum] = useState<string | null>(null);
  const [selectedMediaSlugs, setSelectedMediaSlugs] = useState<string[]>([]);

  const getMediaIcon = (type: string | null | undefined) => {
    switch (type) {
      case 'article': return '📄';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'book': return '📚';
      case 'pdf': return '📄';
      default: return '📎';
    }
  };

  // Load albums
  const loadAlbums = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/curator/albums/by-voyage/${voyageSlug}`);
      if (response.ok) {
        const data = await response.json();
        setAlbums(data);
      }
    } catch (error) {
      console.error('Failed to load albums:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load album details with media
  const loadAlbumDetails = async (albumSlug: string) => {
    try {
      const response = await fetch(`/api/curator/albums/${albumSlug}`);
      if (response.ok) {
        const data = await response.json();
        setAlbums(prev => prev.map(a => a.album_slug === albumSlug ? { ...a, media: data.media } : a));
      }
    } catch (error) {
      console.error('Failed to load album details:', error);
    }
  };

  useEffect(() => {
    loadAlbums();
  }, [voyageSlug]);

  // Create new album
  const createAlbum = async () => {
    if (!newAlbumTitle.trim()) {
      alert('Album title is required');
      return;
    }

    try {
      const response = await fetch('/api/curator/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAlbumTitle,
          description: newAlbumDescription,
          voyage_slug: voyageSlug,
          sort_order: albums.length
        })
      });

      if (response.ok) {
        setNewAlbumTitle('');
        setNewAlbumDescription('');
        setShowCreateForm(false);
        loadAlbums();
      } else {
        alert('Failed to create album');
      }
    } catch (error) {
      console.error('Failed to create album:', error);
      alert('Failed to create album');
    }
  };

  // Delete album
  const deleteAlbum = async (albumSlug: string, albumTitle: string) => {
    if (!confirm(`Delete album "${albumTitle}"? Media will not be deleted.`)) return;

    try {
      const response = await fetch(`/api/curator/albums/${albumSlug}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadAlbums();
      } else {
        alert('Failed to delete album');
      }
    } catch (error) {
      console.error('Failed to delete album:', error);
      alert('Failed to delete album');
    }
  };

  // Add media to album
  const addMediaToAlbum = async (albumSlug: string) => {
    if (selectedMediaSlugs.length === 0) {
      alert('Please select media to add');
      return;
    }

    try {
      // Add each selected media item
      for (const mediaSlug of selectedMediaSlugs) {
        await fetch(`/api/curator/albums/${albumSlug}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_slug: mediaSlug,
            sort_order: 0
          })
        });
      }

      setSelectedMediaSlugs([]);
      setAddingToAlbum(null);
      loadAlbums();
      loadAlbumDetails(albumSlug);
    } catch (error) {
      console.error('Failed to add media to album:', error);
      alert('Failed to add media to album');
    }
  };

  // Remove media from album
  const removeMediaFromAlbum = async (albumSlug: string, mediaSlug: string) => {
    try {
      const response = await fetch(`/api/curator/albums/${albumSlug}/media/${mediaSlug}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadAlbums();
        loadAlbumDetails(albumSlug);
      } else {
        alert('Failed to remove media from album');
      }
    } catch (error) {
      console.error('Failed to remove media from album:', error);
      alert('Failed to remove media from album');
    }
  };

  // Toggle album expansion
  const toggleAlbum = (albumSlug: string) => {
    if (expandedAlbum === albumSlug) {
      setExpandedAlbum(null);
    } else {
      setExpandedAlbum(albumSlug);
      const album = albums.find(a => a.album_slug === albumSlug);
      if (album && !album.media) {
        loadAlbumDetails(albumSlug);
      }
    }
  };

  // Get available media (not in current album)
  const getAvailableMedia = (albumSlug: string) => {
    const album = albums.find(a => a.album_slug === albumSlug);
    if (!album || !album.media) return media;

    const albumMediaSlugs = album.media.map(m => m.media_slug);
    return media.filter(m => !albumMediaSlugs.includes(m.media_slug));
  };

  if (loading) {
    return <div className="text-sm text-gray-600">Loading albums...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">
          📚 Albums {albums.length > 0 && `(${albums.length})`}
        </h4>
        {editMode && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="text-sm bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700"
          >
            {showCreateForm ? 'Cancel' : '+ Create Album'}
          </button>
        )}
      </div>

      {/* Create Album Form */}
      {editMode && showCreateForm && (
        <div className="bg-gray-50 p-4 rounded border border-gray-300 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Album Title *</label>
            <input
              type="text"
              value={newAlbumTitle}
              onChange={(e) => setNewAlbumTitle(e.target.value)}
              placeholder="e.g., Deck Photos, Crew Portraits, etc."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={newAlbumDescription}
              onChange={(e) => setNewAlbumDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <button
            onClick={createAlbum}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
          >
            Create Album
          </button>
        </div>
      )}

      {/* Albums List */}
      {albums.length === 0 ? (
        <p className="text-sm text-gray-600">No albums yet. {editMode && 'Click "Create Album" to get started.'}</p>
      ) : (
        <div className="space-y-3">
          {albums.map(album => {
            const isExpanded = expandedAlbum === album.album_slug;
            const availableMedia = getAvailableMedia(album.album_slug);

            return (
              <div key={album.album_slug} className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                {/* Album Header */}
                <div
                  className="flex items-center justify-between p-3 bg-indigo-50 cursor-pointer hover:bg-indigo-100"
                  onClick={() => toggleAlbum(album.album_slug)}
                >
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{album.title}</h5>
                    {album.description && (
                      <p className="text-xs text-gray-600 mt-1">{album.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {album.media_count} {album.media_count === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAlbum(album.album_slug, album.title);
                        }}
                        className="text-red-600 hover:text-red-800 text-sm px-2"
                        title="Delete album"
                      >
                        🗑️
                      </button>
                    )}
                    <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {/* Album Content (when expanded) */}
                {isExpanded && (
                  <div className="p-3 border-t border-gray-200">
                    {/* Add Media Section (edit mode only) */}
                    {editMode && addingToAlbum === album.album_slug && (
                      <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-300">
                        <h6 className="text-sm font-medium text-gray-700 mb-2">Select media to add:</h6>
                        {availableMedia.length === 0 ? (
                          <p className="text-sm text-gray-600">All voyage media is already in this album</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto mb-3">
                              {availableMedia.map(mediaItem => (
                                <div
                                  key={mediaItem.media_slug}
                                  className={`relative cursor-pointer border-2 rounded ${
                                    selectedMediaSlugs.includes(mediaItem.media_slug)
                                      ? 'border-indigo-600 bg-indigo-50'
                                      : 'border-gray-300 hover:border-indigo-400'
                                  }`}
                                  onClick={() => {
                                    if (selectedMediaSlugs.includes(mediaItem.media_slug)) {
                                      setSelectedMediaSlugs(prev => prev.filter(s => s !== mediaItem.media_slug));
                                    } else {
                                      setSelectedMediaSlugs(prev => [...prev, mediaItem.media_slug]);
                                    }
                                  }}
                                >
                                  <div className="aspect-square">
                                    {mediaItem.media_type === 'image' ? (
                                      <img
                                        src={mediaItem.public_derivative_url || mediaItem.s3_url || ''}
                                        alt={mediaItem.title || ''}
                                        className="w-full h-full object-cover rounded"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded">
                                        <div className="text-2xl">{getMediaIcon(mediaItem.media_type)}</div>
                                      </div>
                                    )}
                                  </div>
                                  {selectedMediaSlugs.includes(mediaItem.media_slug) && (
                                    <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                      ✓
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => addMediaToAlbum(album.album_slug)}
                                className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700 text-sm"
                                disabled={selectedMediaSlugs.length === 0}
                              >
                                Add Selected ({selectedMediaSlugs.length})
                              </button>
                              <button
                                onClick={() => {
                                  setAddingToAlbum(null);
                                  setSelectedMediaSlugs([]);
                                }}
                                className="bg-gray-600 text-white px-4 py-1 rounded hover:bg-gray-700 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Add Media Button */}
                    {editMode && addingToAlbum !== album.album_slug && availableMedia.length > 0 && (
                      <button
                        onClick={() => setAddingToAlbum(album.album_slug)}
                        className="mb-3 bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm"
                      >
                        + Add Media to Album
                      </button>
                    )}

                    {/* Album Media Grid */}
                    {!album.media ? (
                      <p className="text-sm text-gray-600">Loading...</p>
                    ) : album.media.length === 0 ? (
                      <p className="text-sm text-gray-600">No media in this album yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {album.media.map(mediaItem => (
                          <div key={mediaItem.media_slug} className="relative group">
                            <a
                              href={mediaItem.s3_url || mediaItem.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-square rounded overflow-hidden border border-gray-200 hover:border-indigo-500"
                            >
                              {mediaItem.media_type === 'image' ? (
                                <img
                                  src={mediaItem.public_derivative_url || mediaItem.s3_url || ''}
                                  alt={mediaItem.title || ''}
                                  className="w-full h-full object-cover group-hover:opacity-90"
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                  <div className="text-center p-2">
                                    <div className="text-3xl mb-1">{getMediaIcon(mediaItem.media_type)}</div>
                                    <div className="text-xs text-gray-600 line-clamp-2">{mediaItem.title}</div>
                                  </div>
                                </div>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                <div className="text-white text-xs line-clamp-2">{mediaItem.title || mediaItem.credit}</div>
                              </div>
                            </a>
                            {editMode && (
                              <button
                                onClick={() => removeMediaFromAlbum(album.album_slug, mediaItem.media_slug)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-xs"
                                title="Remove from album"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AlbumManager;
