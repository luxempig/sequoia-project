// src/components/MediaGallery.tsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { MediaItem } from "../types";
import { looksLikeImage, looksLikeVideo } from "../utils/media";

/** Simple lightbox for images */
const Lightbox: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({
  src,
  alt,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-8 h-8 shadow"
          aria-label="Close"
        >
          ✕
        </button>
        <img src={src} alt={alt || "Media"} className="w-full max-h-[85vh] object-contain rounded-lg bg-white" />
      </div>
    </div>
  );
};

type Tile = {
  id: string;
  kind: "image" | "video" | "other";
  url: string;
  caption?: string;
  originalUrl?: string;  // For thumbnails, this is the full-res original
};

const toTile = (m: MediaItem): Tile | null => {
  // Only use S3 URLs from sequoia-canonical bucket
  const s3Url = m.s3_url || "";
  if (!s3Url || !s3Url.includes('sequoia-canonical')) return null;

  const parts: string[] = [];
  if (m.title) parts.push(m.title);
  else if (m.media_type) parts.push(m.media_type);
  else parts.push("Media");

  if (m.date) parts.push(m.date);
  if (m.description_markdown) parts.push(m.description_markdown);

  const caption = parts.join(" — ");

  // Always use original S3 file, never thumbnails
  if (looksLikeImage(s3Url) || m.media_type === 'image') {
    return { id: m.media_slug, kind: "image", url: s3Url, caption, originalUrl: s3Url };
  }
  if (looksLikeVideo(s3Url) || m.media_type === 'video') {
    return { id: m.media_slug, kind: "video", url: s3Url, caption };
  }
  // For PDFs, show as document tile
  if (m.media_type === 'pdf') {
    return { id: m.media_slug, kind: "other", url: s3Url, caption };
  }
  return { id: m.media_slug, kind: "other", url: s3Url, caption };
};

interface MediaGalleryProps {
  voyageSlug: string;
  editMode?: boolean;
  onMediaChange?: () => void; // Callback when media is removed or updated
}

const MediaGallery: React.FC<MediaGalleryProps> = ({ voyageSlug, editMode = false, onMediaChange }) => {
  const [raw, setRaw] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [mediaFormData, setMediaFormData] = useState({
    title: '',
    date: '',
    credit: '',
    description_markdown: '',
    media_type: 'image'
  });

  const loadMedia = () => {
    setLoading(true);
    api
      .getVoyageMedia(voyageSlug)
      .then((data) => {
        const mediaData = Array.isArray(data) ? data : [];
        setRaw(mediaData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMedia();
  }, [voyageSlug]);

  const openEditMedia = (media: MediaItem) => {
    setEditingMedia(media);
    setMediaFormData({
      title: media.title || '',
      date: media.date || '',
      credit: media.credit || '',
      description_markdown: media.description_markdown || '',
      media_type: media.media_type || 'image'
    });
  };

  const saveEditedMedia = async () => {
    if (!editingMedia) return;

    try {
      const response = await fetch(`/api/curator/media/${editingMedia.media_slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaFormData)
      });

      if (response.ok) {
        alert('Media updated successfully!');
        setEditingMedia(null);
        loadMedia();
        if (onMediaChange) onMediaChange();
      } else {
        alert('Failed to update media');
      }
    } catch (error) {
      console.error('Update failed:', error);
      alert(`Failed to update media: ${error}`);
    }
  };

  const handleRemoveMedia = async () => {
    if (!editingMedia) return;

    if (!confirm(`Remove "${editingMedia.title}" from this voyage? (The media will still exist in the media explorer)`)) {
      return;
    }

    try {
      const response = await fetch(`/api/curator/media/unlink-from-voyage?media_slug=${encodeURIComponent(editingMedia.media_slug)}&voyage_slug=${encodeURIComponent(voyageSlug)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setEditingMedia(null);
        loadMedia();
        if (onMediaChange) onMediaChange();
      } else {
        alert('Failed to remove media from voyage');
      }
    } catch (error) {
      console.error('Remove failed:', error);
      alert('Failed to remove media');
    }
  };

  const tiles = useMemo(
    () => raw.map(toTile).filter(Boolean) as Tile[],
    [raw]
  );

  if (loading) return <p className="text-gray-600">Loading media…</p>;
  if (tiles.length === 0) return <p className="text-gray-600">No media.</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => {
          if (t.kind === "image") {
            const displayUrl = t.url;  // Thumbnail or image
            const originalUrl = t.originalUrl || t.url;  // Full resolution original

            const mediaItem = raw.find(m => m.media_slug === t.id);
            return (
              <figure key={t.id} className="rounded overflow-hidden bg-white ring-1 ring-gray-200 shadow-sm relative">
                {editMode && mediaItem && (
                  <button
                    onClick={() => openEditMedia(mediaItem)}
                    className="absolute top-2 right-2 z-10 bg-white hover:bg-gray-100 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg"
                    title="Edit media"
                  >
                    ✏️
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpenSrc(originalUrl)}
                  className="block w-full aspect-square bg-gray-50 hover:bg-gray-100 transition-colors"
                  title={t.caption || "Click to enlarge"}
                >
                  <img
                    src={displayUrl}
                    alt={t.caption || "Voyage media"}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <figcaption className="p-2 text-xs text-gray-700">
                  <div className="line-clamp-3">{t.caption || "Media"}</div>
                  <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Open original →
                  </a>
                </figcaption>
              </figure>
            );
          }

          if (t.kind === "video") {
            const mediaItem = raw.find(m => m.media_slug === t.id);
            return (
              <figure key={t.id} className="rounded overflow-hidden bg-white ring-1 ring-gray-200 shadow-sm relative">
                {editMode && mediaItem && (
                  <button
                    onClick={() => openEditMedia(mediaItem)}
                    className="absolute top-2 right-2 z-10 bg-white hover:bg-gray-100 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg"
                    title="Edit media"
                  >
                    ✏️
                  </button>
                )}
                <video
                  className="w-full aspect-square bg-black object-cover"
                  controls
                  preload="metadata"
                  onError={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (!parent) return;
                    e.currentTarget.style.display = "none";
                    const div = document.createElement("div");
                    div.className = "w-full aspect-square flex items-center justify-center bg-gray-50 text-gray-600 text-sm";
                    div.innerHTML = `<a href="${t.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">Open video</a>`;
                    parent.insertBefore(div, parent.firstChild);
                  }}
                >
                  <source src={t.url} />
                </video>
                <figcaption className="p-2 text-xs text-gray-700">
                  <div className="line-clamp-3">{t.caption || "Video"}</div>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Open original
                  </a>
                </figcaption>
              </figure>
            );
          }

          // Determine document type for better icon
          const isPDF = t.url.toLowerCase().includes('.pdf') || t.caption?.toLowerCase().includes('pdf');
          const isAudio = t.url.toLowerCase().match(/\.(mp3|wav|ogg|m4a)$/);
          const mediaItem = raw.find(m => m.media_slug === t.id);

          return (
            <figure key={t.id} className="rounded overflow-hidden bg-white ring-1 ring-gray-200 shadow-sm p-4 flex items-start gap-3 relative">
              {editMode && mediaItem && (
                <button
                  onClick={() => openEditMedia(mediaItem)}
                  className="absolute top-2 right-2 z-10 bg-white hover:bg-gray-100 border border-gray-300 rounded-full w-8 h-8 flex items-center justify-center text-lg shadow-lg"
                  title="Edit media"
                >
                  ✏️
                </button>
              )}
              <div className={`shrink-0 w-10 h-10 rounded flex items-center justify-center text-xl ${
                isPDF ? 'bg-red-50 border border-red-200' :
                isAudio ? 'bg-blue-50 border border-blue-200' :
                'bg-gray-100 border border-gray-300'
              }`}>
                {isPDF ? '📄' : isAudio ? '🔊' : '📎'}
              </div>
              <figcaption className="text-sm flex-1">
                <div className="text-gray-800 font-medium mb-1">
                  {isPDF ? 'PDF Document' : isAudio ? 'Audio File' : 'Document'}
                </div>
                <div className="text-gray-600 text-xs line-clamp-2 mb-2">{t.caption || "External media"}</div>
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                  Open in new tab →
                </a>
              </figcaption>
            </figure>
          );
        })}
      </div>

      {openSrc && <Lightbox src={openSrc} alt="Voyage media" onClose={() => setOpenSrc(null)} />}

      {/* Media Edit Modal */}
      {editingMedia && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setEditingMedia(null)}></div>

            {/* Center modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Edit Media: {editingMedia.title || editingMedia.media_slug}
                    </h3>

                    <div className="space-y-4">
                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={mediaFormData.title}
                          onChange={(e) => setMediaFormData({ ...mediaFormData, title: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                          type="date"
                          value={mediaFormData.date}
                          onChange={(e) => setMediaFormData({ ...mediaFormData, date: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Credit */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Credit</label>
                        <input
                          type="text"
                          value={mediaFormData.credit}
                          onChange={(e) => setMediaFormData({ ...mediaFormData, credit: e.target.value })}
                          placeholder="White House Photography Office"
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Media Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Media Type</label>
                        <select
                          value={mediaFormData.media_type}
                          onChange={(e) => setMediaFormData({ ...mediaFormData, media_type: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        >
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                          <option value="pdf">PDF</option>
                          <option value="document">Document</option>
                        </select>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={mediaFormData.description_markdown}
                          onChange={(e) => setMediaFormData({ ...mediaFormData, description_markdown: e.target.value })}
                          rows={3}
                          placeholder="Description of the media..."
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={saveEditedMedia}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleRemoveMedia}
                >
                  Remove from Voyage
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setEditingMedia(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
