import React, { useState, useEffect } from "react";

interface Media {
  media_slug: string;
  title: string;
  media_type: string;
  url: string;
  credit?: string;
  date?: string;
  description_markdown?: string;
}

interface MediaSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: Media) => void;
  excludeMediaSlugs?: string[]; // Already used in current voyage
}

const MediaSearchModal: React.FC<MediaSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  excludeMediaSlugs = [],
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaType, setMediaType] = useState("all");
  const [results, setResults] = useState<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      searchMedia();
    }
  }, [isOpen, searchQuery, mediaType]);

  const searchMedia = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (mediaType !== "all") params.append("media_type", mediaType);
      params.append("limit", "100");

      const response = await fetch(`/api/media/?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to search media");

      const data = await response.json();
      // Filter out media already in use
      const filtered = data.filter((m: Media) => !excludeMediaSlugs.includes(m.media_slug));
      setResults(filtered);
    } catch (err) {
      setError(`Error searching media: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedMedia) {
      onSelect(selectedMedia);
      onClose();
      setSearchQuery("");
      setMediaType("all");
      setSelectedMedia(null);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "image":
        return "🖼️";
      case "video":
        return "🎬";
      case "pdf":
        return "📄";
      default:
        return "📋";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        {/* Modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 pt-5 pb-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Select Media from Explorer</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search and filters */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Search by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="pdf">PDFs</option>
                  <option value="document">Documents</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-gray-50 px-6 py-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading media...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">{error}</div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No media found</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.map((media) => (
                  <div
                    key={media.media_slug}
                    onClick={() => setSelectedMedia(media)}
                    className={`cursor-pointer border-2 rounded-lg p-2 transition-all ${
                      selectedMedia?.media_slug === media.media_slug
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-gray-100 rounded flex items-center justify-center overflow-hidden mb-2">
                      {media.media_type === "image" && media.url ? (
                        <img src={media.url} alt={media.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">{getMediaIcon(media.media_type)}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="text-xs">
                      <p className="font-medium text-gray-900 truncate">{media.title || "Untitled"}</p>
                      <p className="text-gray-500 truncate">{media.media_type}</p>
                      {media.date && <p className="text-gray-400">{media.date}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview & Actions */}
          {selectedMedia && (
            <div className="bg-white border-t border-gray-200 px-6 py-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Selected Media:</h4>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded flex items-center justify-center">
                  {selectedMedia.media_type === "image" && selectedMedia.url ? (
                    <img src={selectedMedia.url} alt={selectedMedia.title} className="w-full h-full object-cover rounded" />
                  ) : (
                    <span className="text-3xl">{getMediaIcon(selectedMedia.media_type)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedMedia.title || "Untitled"}</p>
                  <p className="text-sm text-gray-500">Type: {selectedMedia.media_type}</p>
                  {selectedMedia.date && <p className="text-sm text-gray-500">Date: {selectedMedia.date}</p>}
                  {selectedMedia.credit && <p className="text-sm text-gray-500">Credit: {selectedMedia.credit}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 sm:flex sm:flex-row-reverse border-t border-gray-200">
            <button
              type="button"
              disabled={!selectedMedia}
              onClick={handleSelect}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm ${
                selectedMedia
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              Add to Voyage
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaSearchModal;
