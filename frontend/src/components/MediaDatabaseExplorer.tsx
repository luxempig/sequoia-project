import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "./Layout";
import { MediaItem } from "../types";
import ConfirmationDialog, { ConfirmationDialogProps } from "./ConfirmationDialog";
import MediaUploadDialog from "./MediaUploadDialog";

interface MediaUsage {
  media_slug: string;
  usage_count: number;
  voyages: Array<{
    voyage_slug: string;
    title: string;
    start_date: string;
    end_date: string;
  }>;
}

const MediaDatabaseExplorer: React.FC = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Local error state for operations (delete, etc.)
  const [operationError, setOperationError] = useState("");

  // Dialogs
  const [confirmationDialog, setConfirmationDialog] = useState<Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'> | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  // Fetch media with React Query and pagination
  const { data: media = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['media', searchQuery, mediaTypeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (mediaTypeFilter !== "all") params.append("media_type", mediaTypeFilter);
      params.append("limit", pageSize.toString());
      params.append("offset", ((page - 1) * pageSize).toString());

      const response = await fetch(`/api/media/?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load media");

      return await response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const checkMediaUsage = async (mediaSlug: string): Promise<MediaUsage> => {
    const response = await fetch(`/api/curator/media/${mediaSlug}/usage`);
    if (!response.ok) {
      throw new Error("Failed to check media usage");
    }
    return await response.json();
  };

  const handleDeleteClick = async (media: MediaItem) => {
    try {
      setDeleteInProgress(true);

      // Check if media is used in any voyages
      const usage = await checkMediaUsage(media.media_slug);

      if (usage.usage_count > 0) {
        // Show warning with voyage list
        setConfirmationDialog({
          type: 'warning',
          title: 'Warning: Media in use',
          message: `This media is used in ${usage.usage_count} voyage(s):`,
          details: [
            ...usage.voyages.map(v => `• ${v.title || v.voyage_slug} (${v.start_date})`),
            '',
            'Deleting will remove it from all voyages and S3 storage.'
          ],
          primaryButton: {
            label: 'Delete Permanently',
            action: () => confirmDelete(media),
            variant: 'danger'
          },
          secondaryButton: {
            label: 'Cancel',
            action: () => {}
          }
        });
      } else {
        // No usage, show simpler confirmation
        setConfirmationDialog({
          type: 'warning',
          title: 'Confirm deletion',
          message: `Are you sure you want to permanently delete "${media.title || media.media_slug}"?`,
          details: [
            'This will:',
            '• Delete from database only',
            '• S3 files will NOT be deleted',
            '',
            'This action cannot be undone.'
          ],
          primaryButton: {
            label: 'Delete Permanently',
            action: () => confirmDelete(media),
            variant: 'danger'
          },
          secondaryButton: {
            label: 'Cancel',
            action: () => {}
          }
        });
      }
    } catch (err) {
      setOperationError(`Failed to check media usage: ${err}`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const confirmDelete = async (media: MediaItem) => {
    try {
      setDeleteInProgress(true);

      const response = await fetch(`/api/curator/media/${media.media_slug}?delete_from_s3=false`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete media');
      }

      const result = await response.json();

      // Show success dialog
      setConfirmationDialog({
        type: 'success',
        title: 'Media permanently deleted',
        message: 'The media has been:',
        details: [
          result.voyages_removed_from > 0 ? `• Removed from ${result.voyages_removed_from} voyage(s)` : '',
          '• Deleted from database',
          '• S3 files preserved',
          '',
          'Database record removed successfully.'
        ].filter(Boolean)
      });

      // Reload media list
      await refetch();
      setSelectedMedia(null);
    } catch (err) {
      setOperationError(`Failed to delete media: ${err}`);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleUploadSuccess = async (mediaSlug: string) => {
    setConfirmationDialog({
      type: 'success',
      title: 'Media uploaded to Media Explorer',
      message: 'Your media has been uploaded and is available for use.',
      details: [
        'To add it to a voyage:',
        '• Go to Voyage Editor',
        '• Click "Add Media" → "Select from Media Explorer"',
        `• Search for: "${mediaSlug}"`
      ]
    });

    // Reload media list
    await refetch();
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "article":
        return "📄";
      case "image":
        return "🖼️";
      case "video":
        return "🎬";
      case "audio":
        return "🎵";
      case "book":
        return "📚";
      case "pdf": // Legacy support
        return "📄";
      default:
        return "📋";
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-blue-800 mb-2">
                  Media Database Explorer
                </h1>
                <p className="text-gray-600">
                  Manage media records • {media.length} items
                </p>
              </div>
              <button
                onClick={() => setShowUploadDialog(true)}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                + Upload Media
              </button>
            </div>
          </div>

          {/* Error Messages */}
          {(error || operationError) && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error ? (error instanceof Error ? error.message : String(error)) : operationError}
            </div>
          )}

          {/* Search and Filters */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Search by title or description..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1); // Reset to first page on search
                  }}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <select
                  value={mediaTypeFilter}
                  onChange={(e) => {
                    setMediaTypeFilter(e.target.value);
                    setPage(1); // Reset to first page on filter change
                  }}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="article">Articles</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                  <option value="book">Books</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Media Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Media List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg p-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading media...</p>
                  </div>
                ) : media.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No media found
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {media.map((item: MediaItem) => (
                      <div
                        key={item.media_slug}
                        onClick={() => setSelectedMedia(item)}
                        className={`cursor-pointer border-2 rounded-lg p-2 transition-all ${
                          selectedMedia?.media_slug === item.media_slug
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-square bg-gray-100 rounded flex items-center justify-center overflow-hidden mb-2">
                          {item.media_type === "image" && item.url ? (
                            <img src={item.url} alt={item.title || ''} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-4xl">{getMediaIcon(item.media_type || 'document')}</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="text-xs">
                          <p className="font-medium text-gray-900 truncate">{item.title || "Untitled"}</p>
                          <p className="text-gray-500 truncate">{item.media_type}</p>
                          {item.date && <p className="text-gray-400">{item.date}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {!loading && media.length > 0 && (
                  <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{page}</span> ({media.length} items)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${
                          page === 1
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Previous
                      </button>
                      <span className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md">
                        {page}
                      </span>
                      <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={media.length < pageSize}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${
                          media.length < pageSize
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details Panel */}
            <div className="lg:col-span-1">
              {selectedMedia ? (
                <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    {selectedMedia.title || selectedMedia.media_slug}
                  </h3>

                  {/* Preview */}
                  <div className="mb-4">
                    {selectedMedia.media_type === "image" && selectedMedia.url ? (
                      <img
                        src={selectedMedia.url}
                        alt={selectedMedia.title || ''}
                        className="w-full rounded border border-gray-200"
                      />
                    ) : (
                      <div className="aspect-square bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-6xl">{getMediaIcon(selectedMedia.media_type || 'document')}</span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="ml-2 text-gray-600">{selectedMedia.media_type}</span>
                    </div>
                    {selectedMedia.credit && (
                      <div>
                        <span className="font-medium text-gray-700">Credit:</span>
                        <span className="ml-2 text-gray-600">{selectedMedia.credit}</span>
                      </div>
                    )}
                    {selectedMedia.date && (
                      <div>
                        <span className="font-medium text-gray-700">Date:</span>
                        <span className="ml-2 text-gray-600">{selectedMedia.date}</span>
                      </div>
                    )}
                    {selectedMedia.description_markdown && (
                      <div>
                        <span className="font-medium text-gray-700">Description:</span>
                        <p className="mt-1 text-gray-600">{selectedMedia.description_markdown}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    {selectedMedia.url && (
                      <a
                        href={selectedMedia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded hover:bg-blue-700"
                      >
                        Open in New Tab
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteClick(selectedMedia)}
                      disabled={deleteInProgress}
                      className="block w-full bg-red-600 text-white text-center px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteInProgress ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                    <p>ID: {selectedMedia.media_slug}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-500 sticky top-4">
                  <p>Select a media item to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {confirmationDialog && (
          <ConfirmationDialog
            isOpen={true}
            onClose={() => setConfirmationDialog(null)}
            {...confirmationDialog}
          />
        )}

        {/* Upload Dialog */}
        <MediaUploadDialog
          isOpen={showUploadDialog}
          onClose={() => setShowUploadDialog(false)}
          onSuccess={handleUploadSuccess}
          autoLinkToVoyage={false}
        />
      </div>
    </Layout>
  );
};

export default MediaDatabaseExplorer;
