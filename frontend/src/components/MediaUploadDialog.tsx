import React, { useState } from "react";

interface MediaUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (mediaSlug: string) => void;
  voyageSlug?: string; // If provided, will link to this voyage
  autoLinkToVoyage?: boolean; // If true, automatically link after upload
  mediaCategory?: 'source' | 'additional_source'; // Category for this upload
}

const MediaUploadDialog: React.FC<MediaUploadDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  voyageSlug,
  autoLinkToVoyage = false,
  mediaCategory: initialMediaCategory = 'source',
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
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<any[]>([]);
  const [mediaCategory, setMediaCategory] = useState<'source' | 'additional_source'>(initialMediaCategory);
  const [presidentSlug, setPresidentSlug] = useState("");
  const [presidents, setPresidents] = useState<any[]>([]);

  // Load presidents if not uploading via voyage
  React.useEffect(() => {
    if (!voyageSlug && isOpen) {
      fetch('/api/people?limit=500')
        .then(res => res.json())
        .then(data => {
          // Filter to only presidents (people with role containing "President")
          const pres = data.filter((p: any) =>
            p.role_title?.toLowerCase().includes('president') ||
            p.person_slug?.includes('president')
          );
          setPresidents(pres);
        })
        .catch(err => console.error('Failed to load presidents:', err));
    }
  }, [voyageSlug, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);

      // Auto-detect media type
      const type = selectedFile.type;
      if (type.startsWith("image/")) setMediaType("image");
      else if (type.startsWith("video/")) setMediaType("video");
      else if (type.startsWith("audio/")) setMediaType("audio");
      else if (type === "application/pdf") setMediaType("pdf");
      else setMediaType("other");

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

  const checkForDuplicates = async (): Promise<any[]> => {
    // Only check if we have credit and date (key duplicate indicators)
    if (!credit || !date) {
      return [];
    }

    try {
      // Get president/owner from voyage if provided
      let presidentOwner = "unattached";
      if (voyageSlug) {
        const voyageResponse = await fetch(`/api/voyages/${voyageSlug}`);
        if (voyageResponse.ok) {
          const voyageData = await voyageResponse.json();
          presidentOwner = voyageData.president_name || voyageData.president_slug_from_voyage || "unattached";
        }
      }

      // Search for media with same credit and date
      const searchParams = new URLSearchParams();
      searchParams.append("limit", "1000");
      const response = await fetch(`/api/curator/media/search?${searchParams}`);

      if (!response.ok) {
        return [];
      }

      const allMedia = await response.json();

      // Filter for potential duplicates
      const duplicates = allMedia.filter((media: any) => {
        // Match on credit and date
        const sameCredit = media.credit && credit &&
          media.credit.toLowerCase().trim() === credit.toLowerCase().trim();
        const sameDate = media.date === date;

        // For each media, check if it belongs to the same president/owner
        // We'll check the S3 URL path to see if it's under the same president
        let samePresident = false;
        if (media.s3_url) {
          const urlPath = media.s3_url.split('.amazonaws.com/')[1] || '';
          const pathPresident = urlPath.split('/')[0] || '';
          samePresident = pathPresident.toLowerCase().includes(presidentOwner.toLowerCase().replace(/\s+/g, '-'));
        }

        return sameCredit && sameDate && samePresident;
      });

      return duplicates;
    } catch (err) {
      console.error("Error checking for duplicates:", err);
      return [];
    }
  };

  const handleUpload = async (skipDuplicateCheck: boolean = false) => {
    if (!file || !title) {
      setError("Please select a file and provide a title");
      return;
    }

    // Require president for standalone uploads
    if (!voyageSlug && !presidentSlug) {
      setError("Please select a president");
      return;
    }

    // Check for duplicates first (unless we're bypassing the check)
    if (!skipDuplicateCheck) {
      const duplicates = await checkForDuplicates();
      if (duplicates.length > 0) {
        setPotentialDuplicates(duplicates);
        setShowDuplicateConfirm(true);
        return; // Stop here and show confirmation dialog
      }
    }

    setUploading(true);
    setError("");

    try {
      // Generate media_slug from title and date
      const datePrefix = date ? date.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
      const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const mediaSlug = `${voyageSlug || 'media'}-${titleSlug}-${datePrefix}-${Date.now().toString().slice(-4)}`;

      // Create FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("media_slug", mediaSlug);
      formData.append("title", title);
      formData.append("media_type", mediaType);
      formData.append("media_category", mediaCategory);
      if (credit) formData.append("credit", credit);
      if (date) formData.append("date", date);
      if (description) formData.append("description_markdown", description);
      if (tags) formData.append("tags", tags);
      if (voyageSlug) formData.append("voyage_slug", voyageSlug);
      if (presidentSlug) formData.append("president_slug", presidentSlug);

      // Upload media
      const uploadResponse = await fetch("/api/curator/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      await uploadResponse.json(); // Just validate response

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
    setShowDuplicateConfirm(false);
    setPotentialDuplicates([]);
    setMediaCategory(initialMediaCategory);
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
                  <option value="article">Article</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="book">Book</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* President Selection (only show when NOT linked to voyage) */}
              {!voyageSlug && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    President <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={presidentSlug}
                    onChange={(e) => setPresidentSlug(e.target.value)}
                    className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a president...</option>
                    {presidents.map((pres) => (
                      <option key={pres.person_slug} value={pres.person_slug}>
                        {pres.full_name} {pres.role_title && `(${pres.role_title})`}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Required for organizing media in S3 storage
                  </p>
                </div>
              )}

              {/* Media Category (only show when linked to voyage) */}
              {voyageSlug && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={mediaCategory}
                    onChange={(e) => setMediaCategory(e.target.value as 'source' | 'additional_source')}
                    className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="source">Source</option>
                    <option value="additional_source">Additional Source</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Sources appear in the main Sources section, Additional Sources appear separately
                  </p>
                </div>
              )}


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
                <label className="block text-sm font-medium text-gray-700 mb-2">Date (YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  pattern="\d{4}-\d{2}-\d{2}"
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
              onClick={() => handleUpload(false)}
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

        {/* Duplicate Confirmation Dialog */}
        {showDuplicateConfirm && (
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ml-4">
            <div className="bg-white px-6 pt-5 pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Possible Duplicate Detected
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Found {potentialDuplicates.length} existing media item{potentialDuplicates.length > 1 ? 's' : ''} with the same credit, date, and president/owner:
                    </p>
                    <div className="mt-3 max-h-40 overflow-y-auto bg-gray-50 rounded p-2">
                      {potentialDuplicates.map((dup, idx) => (
                        <div key={idx} className="text-xs mb-2 pb-2 border-b border-gray-200 last:border-0">
                          <div className="font-medium">{dup.title || dup.media_slug}</div>
                          <div className="text-gray-600">
                            Credit: {dup.credit} | Date: {dup.date}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      This might be a duplicate for version control purposes. Are you sure you want to upload this new version?
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateConfirm(false);
                  handleUpload(true); // Skip duplicate check this time
                }}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-yellow-600 text-base font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Yes, Upload Anyway
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateConfirm(false);
                  setPotentialDuplicates([]);
                }}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaUploadDialog;
