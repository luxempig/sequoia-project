import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import { api } from "../api";
import { MediaItem } from "../types";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface Folder {
  name: string;
  path: string;
  type: "folder";
}

interface FileItem {
  name: string;
  path: string;
  size: number;
  last_modified: string;
  type: "image" | "video" | "pdf" | "document";
  url: string;
}

interface S3BrowseResponse {
  bucket: string;
  current_prefix: string;
  breadcrumbs: BreadcrumbItem[];
  folders: Folder[];
  files: FileItem[];
  total_items: number;
}

const MediaExplorer: React.FC = () => {
  const [currentPrefix, setCurrentPrefix] = useState("");
  const [data, setData] = useState<S3BrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [mediaMetadata, setMediaMetadata] = useState<Record<string, MediaItem>>({});

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    credit: "",
    date: "",
    description: "",
    president_slug: "",
    media_type: "image"
  });
  const [uploading, setUploading] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    credit: "",
    date: "",
    description: "",
    media_type: "image"
  });

  // President options for upload
  const [presidents, setPresidents] = useState<any[]>([]);

  useEffect(() => {
    loadDirectory(currentPrefix);
  }, [currentPrefix]);

  useEffect(() => {
    api.listPresidents().then(setPresidents).catch(() => setPresidents([]));
  }, []);

  const loadDirectory = async (prefix: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/s3/browse?prefix=${encodeURIComponent(prefix)}&bucket=sequoia-canonical`
      );
      if (!response.ok) {
        throw new Error("Failed to load directory");
      }
      const result = await response.json();
      setData(result);

      // Load media metadata for files in this directory
      try {
        const allMedia = await api.listMedia(new URLSearchParams({ limit: '1000' }));
        const metadataMap: Record<string, MediaItem> = {};

        result.files.forEach((file: FileItem) => {
          const mediaItem = allMedia.find((m: MediaItem) => m.s3_url === file.url);
          if (mediaItem) {
            metadataMap[file.url] = mediaItem;
          }
        });

        setMediaMetadata(metadataMap);
      } catch (err) {
        console.error('Failed to load media metadata:', err);
      }
    } catch (err) {
      setError(`Error loading directory: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadForm.title) {
      alert("Please select a file and provide a title");
      return;
    }

    setUploading(true);
    try {
      // Generate media_slug
      const datePrefix = uploadForm.date ? uploadForm.date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
      const titleSlug = uploadForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const mediaSlug = `media-${titleSlug}-${datePrefix}-${Date.now().toString().slice(-4)}`;

      // Create FormData
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("media_slug", mediaSlug);
      formData.append("title", uploadForm.title);
      formData.append("media_type", uploadForm.media_type);
      if (uploadForm.credit) formData.append("credit", uploadForm.credit);
      if (uploadForm.date) formData.append("date", uploadForm.date);
      if (uploadForm.description) formData.append("description", uploadForm.description);
      if (uploadForm.president_slug) formData.append("president_slug", uploadForm.president_slug);

      // Upload
      const response = await fetch("/api/curator/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      alert("✓ Media uploaded successfully!");
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({
        title: "",
        credit: "",
        date: "",
        description: "",
        president_slug: "",
        media_type: "image"
      });
      // Reload directory
      loadDirectory(currentPrefix);
    } catch (err) {
      alert(`Upload failed: ${err}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEditClick = async (file: FileItem) => {
    // Try to find media record in database by S3 URL
    try {
      const allMedia = await api.listMedia(new URLSearchParams({ limit: '500' }));
      const mediaItem = allMedia.find((m: MediaItem) => m.s3_url === file.url);

      if (mediaItem) {
        setEditingMedia(mediaItem);
        setEditForm({
          title: mediaItem.title ?? "",
          credit: mediaItem.credit ?? "",
          date: mediaItem.date ?? "",
          description: mediaItem.description_markdown ?? "",
          media_type: mediaItem.media_type ?? "image"
        });
        setShowEditModal(true);
      } else {
        alert("Media not found in database. Upload it first to edit metadata.");
      }
    } catch (err) {
      alert(`Error loading media: ${err}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMedia) return;

    try {
      const response = await fetch(`/api/curator/media/${editingMedia.media_slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        throw new Error("Failed to update media");
      }

      alert("✓ Media updated successfully!");
      setShowEditModal(false);
      setEditingMedia(null);
    } catch (err) {
      alert(`Update failed: ${err}`);
    }
  };

  const handleDelete = async (file: FileItem) => {
    try {
      // Find media record in database
      const allMedia = await api.listMedia(new URLSearchParams({ limit: '500' }));
      const mediaItem = allMedia.find((m: MediaItem) => m.s3_url === file.url);

      if (!mediaItem) {
        alert("Media not found in database. Cannot delete.");
        return;
      }

      // Check which voyages use this media
      const usageResponse = await fetch(`/api/curator/media/${mediaItem.media_slug}/usage`);
      if (!usageResponse.ok) {
        throw new Error("Failed to check media usage");
      }

      const usageData = await usageResponse.json();
      const voyages = usageData.voyages || [];

      // Build confirmation message
      let confirmMessage = `Are you sure you want to delete "${file.name}"?\n\n`;
      confirmMessage += "This will permanently remove it from:\n";
      confirmMessage += "• Database\n";
      confirmMessage += "• S3 storage (both original and thumbnail)\n";

      if (voyages.length > 0) {
        confirmMessage += `\nThis media is currently used in ${voyages.length} voyage${voyages.length > 1 ? 's' : ''}:\n`;
        voyages.forEach((v: any) => {
          confirmMessage += `\n• ${v.title || v.voyage_slug} (${v.start_date || 'no date'})`;
        });
        confirmMessage += "\n\nIt will be removed from all these voyages.";
      } else {
        confirmMessage += "\nThis media is not currently attached to any voyages.";
      }

      if (!confirm(confirmMessage)) {
        return;
      }

      // Delete media (this will delete from DB and S3)
      const response = await fetch(`/api/curator/media/${mediaItem.media_slug}?delete_from_s3=true`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to delete media");
      }

      alert("✓ Media deleted successfully!");
      setSelectedFile(null);
      // Reload directory
      loadDirectory(currentPrefix);
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const getFileIcon = (type: string) => {
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

  return (
    <Layout>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Media Explorer</h1>
                <p className="text-gray-600">Browse, upload, edit, and delete media in sequoia-canonical S3 bucket</p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                + Upload Media
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 border-b pb-4">
              <button
                onClick={() => setCurrentPrefix("")}
                className="hover:text-blue-600 font-medium"
              >
                📦 Root
              </button>
              {data?.breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <span>/</span>
                  <button
                    onClick={() => setCurrentPrefix(crumb.path)}
                    className="hover:text-blue-600"
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading...</p>
              </div>
            )}

            {/* Directory Contents */}
            {!loading && data && (
              <div className="space-y-6">
                <div className="text-sm text-gray-600">
                  {data.total_items} items
                </div>

                {/* Folders */}
                {data.folders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {data.folders.map((folder) => (
                      <div
                        key={folder.path}
                        onClick={() => setCurrentPrefix(folder.path)}
                        className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                      >
                        <span className="text-4xl">📁</span>
                        <p className="text-xs font-medium text-gray-900 text-center truncate w-full">{folder.name}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Files Grid */}
                {data.files.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {data.files.map((file) => {
                      const metadata = mediaMetadata[file.url];
                      const captionParts: string[] = [];
                      if (metadata?.date) captionParts.push(metadata.date);
                      if (metadata?.credit) captionParts.push(metadata.credit);
                      if (metadata?.description_markdown) captionParts.push(metadata.description_markdown);
                      const caption = captionParts.join(' — ') || file.name;

                      return (
                        <figure
                          key={file.path}
                          className={`rounded overflow-hidden bg-white ring-1 shadow-sm cursor-pointer transition-all ${
                            selectedFile?.path === file.path
                              ? "ring-2 ring-blue-500"
                              : "ring-gray-200 hover:ring-gray-300"
                          }`}
                          onClick={() => setSelectedFile(file)}
                        >
                          {file.type === "image" ? (
                            <div className="aspect-square bg-gray-50">
                              <img
                                src={file.url}
                                alt={caption}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : file.type === "video" ? (
                            <div className="aspect-square bg-black flex items-center justify-center">
                              <span className="text-6xl">🎬</span>
                            </div>
                          ) : file.type === "pdf" ? (
                            <div className="aspect-square bg-red-50 flex items-center justify-center border-b border-red-200">
                              <span className="text-6xl">📄</span>
                            </div>
                          ) : (
                            <div className="aspect-square bg-gray-100 flex items-center justify-center">
                              <span className="text-6xl">📋</span>
                            </div>
                          )}
                          <figcaption className="p-2 text-xs text-gray-700">
                            <div className="line-clamp-3 mb-1">{caption}</div>
                            <div className="text-gray-500">{formatFileSize(file.size)}</div>
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                )}

                {data.total_items === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg">This folder is empty</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File Preview Panel */}
          {selectedFile && (
            <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-lg truncate flex-1">
                  {selectedFile.name}
                </h3>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Preview */}
                <div>
                  {selectedFile.type === "image" && (
                    <img
                      src={selectedFile.url}
                      alt={selectedFile.name}
                      className="w-full rounded-lg border border-gray-300"
                    />
                  )}

                  {selectedFile.type === "video" && (
                    <video
                      controls
                      className="w-full rounded-lg border border-gray-300"
                      src={selectedFile.url}
                    >
                      Your browser does not support video playback.
                    </video>
                  )}

                  {selectedFile.type === "pdf" && (
                    <div className="p-12 bg-gray-50 rounded-lg text-center border border-gray-300">
                      <span className="text-8xl">📄</span>
                      <p className="text-sm text-gray-600 mt-4">PDF Document</p>
                    </div>
                  )}

                  {selectedFile.type === "document" && (
                    <div className="p-12 bg-gray-50 rounded-lg text-center border border-gray-300">
                      <span className="text-8xl">📋</span>
                      <p className="text-sm text-gray-600 mt-4">Document</p>
                    </div>
                  )}
                </div>

                {/* Details and Actions */}
                <div className="space-y-4">
                  {/* File Details */}
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Size:</span>
                      <span className="ml-2 text-gray-600">{formatFileSize(selectedFile.size)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="ml-2 text-gray-600">{selectedFile.type}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Modified:</span>
                      <span className="ml-2 text-gray-600">{formatDate(selectedFile.last_modified)}</span>
                    </div>
                    {(() => {
                      const metadata = mediaMetadata[selectedFile.url];
                      if (metadata) {
                        return (
                          <>
                            {metadata.date && (
                              <div>
                                <span className="font-medium text-gray-700">Date:</span>
                                <span className="ml-2 text-gray-600">{metadata.date}</span>
                              </div>
                            )}
                            {metadata.credit && (
                              <div>
                                <span className="font-medium text-gray-700">Credit:</span>
                                <span className="ml-2 text-gray-600">{metadata.credit}</span>
                              </div>
                            )}
                            {metadata.description_markdown && (
                              <div>
                                <span className="font-medium text-gray-700">Description:</span>
                                <span className="ml-2 text-gray-600">{metadata.description_markdown}</span>
                              </div>
                            )}
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-4">
                    <a
                      href={selectedFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Open in New Tab
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedFile.url);
                        alert("URL copied to clipboard!");
                      }}
                      className="block w-full bg-gray-200 text-gray-800 text-center px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Copy URL
                    </button>
                    <button
                      onClick={() => handleEditClick(selectedFile)}
                      className="block w-full bg-green-600 text-white text-center px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Edit Metadata
                    </button>
                    <button
                      onClick={() => handleDelete(selectedFile)}
                      className="block w-full bg-red-600 text-white text-center px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Delete from S3 & DB
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowUploadModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-6 pt-5 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Upload Media to Explorer</h3>
                  <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-500">
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bg-white px-6 py-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          // Auto-fill title from filename
                          if (!uploadForm.title) {
                            const filename = file.name.replace(/\.[^/.]+$/, "");
                            setUploadForm({ ...uploadForm, title: filename });
                          }
                        }
                      }}
                      accept="image/*,video/*,application/pdf,.doc,.docx"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Presidential Group Photo"
                    />
                  </div>

                  {/* Credit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Credit</label>
                    <input
                      type="text"
                      value={uploadForm.credit}
                      onChange={(e) => setUploadForm({ ...uploadForm, credit: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="White House Photography Office"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={uploadForm.date}
                      onChange={(e) => setUploadForm({ ...uploadForm, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* President/Owner */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">President/Owner</label>
                    <select
                      value={uploadForm.president_slug}
                      onChange={(e) => setUploadForm({ ...uploadForm, president_slug: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Unattached</option>
                      {presidents
                        .filter((p) => !['reagan-ronald', 'bush-george-w', 'obama-barack', 'post-presidential'].includes(p.president_slug))
                        .map((p) => (
                          <option key={p.president_slug} value={p.president_slug}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Media Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Media Type</label>
                    <select
                      value={uploadForm.media_type}
                      onChange={(e) => setUploadForm({ ...uploadForm, media_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                      <option value="document">Document</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Official photograph taken during the voyage..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 sm:flex sm:flex-row-reverse border-t border-gray-200">
                <button
                  type="button"
                  disabled={!uploadFile || !uploadForm.title || uploading}
                  onClick={handleUpload}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm ${
                    !uploadFile || !uploadForm.title || uploading
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {uploading ? "Uploading..." : "Upload Media"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingMedia && (
        <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowEditModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-6 pt-5 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Edit Media Metadata</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-500">
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bg-white px-6 py-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Credit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Credit</label>
                    <input
                      type="text"
                      value={editForm.credit}
                      onChange={(e) => setEditForm({ ...editForm, credit: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Media Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Media Type</label>
                    <select
                      value={editForm.media_type}
                      onChange={(e) => setEditForm({ ...editForm, media_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                      <option value="document">Document</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 sm:flex sm:flex-row-reverse border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default MediaExplorer;
