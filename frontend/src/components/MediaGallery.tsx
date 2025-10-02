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
};

const toTile = (m: MediaItem): Tile | null => {
  const url = m.url || m.public_derivative_url || "";
  if (!url) return null;
  const caption =
    (m.title ? `${m.title}` : (m.media_type || "Media")) +
    (m.date ? ` — ${m.date}` : "") +
    (m.description_markdown ? `: ${m.description_markdown}` : "");
  if (looksLikeImage(url)) return { id: m.media_slug, kind: "image", url, caption };
  if (looksLikeVideo(url)) return { id: m.media_slug, kind: "video", url, caption };
  return { id: m.media_slug, kind: "other", url, caption };
};

const MediaGallery: React.FC<{ voyageSlug: string; filterDisplayable?: boolean }> = ({ voyageSlug, filterDisplayable = false }) => {
  const [raw, setRaw] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSrc, setOpenSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .getVoyageMedia(voyageSlug)
      .then((data) => {
        if (!alive) return;
        let mediaData = Array.isArray(data) ? data : [];

        // Filter to only displayable media if requested
        if (filterDisplayable) {
          mediaData = mediaData.filter(m => {
            const url = m.url || m.public_derivative_url || m.s3_url || '';
            return url.includes('drive.google.com') ||
                   url.includes('dropbox.com') ||
                   url.includes('s3.amazonaws.com') ||
                   url.includes('sequoia-');
          });
        }

        setRaw(mediaData);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [voyageSlug, filterDisplayable]);

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
            return (
              <figure key={t.id} className="rounded overflow-hidden bg-white ring-1 ring-gray-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenSrc(t.url)}
                  className="block w-full h-48 bg-gray-50"
                  title={t.caption || "Open image"}
                >
                  <img
                    src={t.url}
                    alt={t.caption || "Voyage image"}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <figcaption className="p-2 text-xs text-gray-700">
                  <div className="line-clamp-3">{t.caption || "Image"}</div>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Open original
                  </a>
                </figcaption>
              </figure>
            );
          }

          if (t.kind === "video") {
            return (
              <figure key={t.id} className="rounded overflow-hidden bg-white ring-1 ring-gray-200 shadow-sm">
                <video
                  className="w-full h-48 bg-black"
                  controls
                  preload="metadata"
                  onError={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (!parent) return;
                    e.currentTarget.style.display = "none";
                    const div = document.createElement("div");
                    div.className = "w-full h-48 flex items-center justify-center bg-gray-50 text-gray-600 text-sm";
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

          return (
            <figure key={t.id} className="rounded overflow-hidden bg-white ring-1 ring-gray-200 shadow-sm p-4 flex items-start gap-3">
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
    </div>
  );
};

export default MediaGallery;
