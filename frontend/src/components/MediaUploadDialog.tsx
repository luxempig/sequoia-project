import React, { useState } from "react";

interface MediaUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (mediaSlug: string) => void;
  voyageSlug?: string; // If provided, will link to this voyage
  autoLinkToVoyage?: boolean; // If true, automatically link after upload
}

const MediaUploadDialog: React.FC<MediaUploadDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  voyageSlug,
  autoLinkToVoyage = false,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [credit, setCredit] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);

      // Auto-detect media type
      const type = selectedFile.type;
      if (type.startsWith("image/")) setMediaType("image");
      else if (type.startsWith("video/")) setMediaType("video");
      else if (type === "application/pdf") setMediaType("pdf");
      else setMediaType("document");

      // Create preview for images
      if (type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreviewUrl("");
      }

      // Auto-fill title from filename
      if (!title) {
        const filename = selectedFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setTitle(filename);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title) {
      setError("Please select a file and provide a title");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("media_type", mediaType);
      if (credit) formData.append("credit", credit);
      if (date) formData.append("date", date);
      if (description) formData.append("description_markdown", description);
      if (tags) formData.append("tags", tags);

      // Upload media
      const uploadResponse = await fetch("/api/curator/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      const uploadedMedia = await uploadResponse.json();
      const mediaSlug = uploadedMedia.media_slug;

      // If should link to voyage, do it
      if (autoLinkToVoyage && voyageSlug) {
        await fetch("/api/curator/media/link-to-voyage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            media_slug: mediaSlug,
            voyage_slug: voyageSlug,
            sort_order: null,
            notes: "",
          }),
        });
      }

      // Success!
      onSuccess(mediaSlug);
      resetForm();
      onClose();
    } catch (err) {
      setError(`Upload failed: ${err}`);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setMediaType("");
    setCredit("");
    setDate("");
    setDescription("");
    setTags("");
    setPreviewUrl("");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleClose}></div>

        {/* Modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 pt-5 pb-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {autoLinkToVoyage ? "Upload New Media to Voyage" : "Upload Media to Explorer"}
              </h3>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white px-6 py-4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,video/*,application/pdf,.doc,.docx"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {previewUrl && (
                  <div className="mt-2">
                    <img src={previewUrl} alt="Preview" className="max-h-48 rounded border border-gray-200" />
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Presidential Group Photo"
                />
              </div>

              {/* Media Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Media Type</label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="pdf">PDF</option>
                  <option value="document">Document</option>
                </select>
              </div>

              {/* Credit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Credit</label>
                <input
                  type="text"
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="White House Photography Office"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Official photograph taken during the voyage..."
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags <span className="text-gray-500 text-xs">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="official, photo, presidential"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 sm:flex sm:flex-row-reverse border-t border-gray-200">
            <button
              type="button"
              disabled={!file || !title || uploading}
              onClick={handleUpload}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm ${
                !file || !title || uploading
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {uploading ? "Uploading..." : autoLinkToVoyage ? "Upload & Add to Voyage" : "Upload to Explorer"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
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

export default MediaUploadDialog;
