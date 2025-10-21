import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Voyage, Person, MediaItem } from "../types";
import { api } from "../api";
import MediaGallery from "./MediaGallery";

interface VoyageCardExpandedProps {
  voyage: Voyage;
  editMode: boolean;
  onSave?: (voyage: Voyage) => void;
  onDelete?: (voyageSlug: string) => void;
  onDuplicate?: (voyageSlug: string) => void;
}

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
};

const formatDateTime = (timestamp: string | null | undefined) => {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return timestamp;
  }
};

const stripMarkdown = (text: string | null | undefined) => {
  if (!text) return '';
  return text
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
};

const VoyageCardExpanded: React.FC<VoyageCardExpandedProps> = ({ voyage, editMode, onSave, onDelete, onDuplicate }) => {
  const [editedVoyage, setEditedVoyage] = useState<Voyage>(voyage);
  const [isEditing, setIsEditing] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Source URLs state
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");

  // Person search state
  const [personSearch, setPersonSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  // Media upload state
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaCredit, setMediaCredit] = useState("");
  const [mediaDate, setMediaDate] = useState("");

  // Load people and media when component mounts
  useEffect(() => {
    setLoadingPeople(true);
    setLoadingMedia(true);

    api.getVoyagePeople(voyage.voyage_slug)
      .then(setPeople)
      .catch(() => setPeople([]))
      .finally(() => setLoadingPeople(false));

    api.getVoyageMedia(voyage.voyage_slug)
      .then(setMedia)
      .catch(() => setMedia([]))
      .finally(() => setLoadingMedia(false));

    // Initialize source URLs
    if (Array.isArray(voyage.source_urls)) {
      setSourceUrls(voyage.source_urls);
    } else if (typeof voyage.source_urls === 'string') {
      setSourceUrls([voyage.source_urls]);
    }
  }, [voyage.voyage_slug, voyage.source_urls]);

  const handleSave = async () => {
    if (onSave) {
      await onSave(editedVoyage);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedVoyage(voyage);
    setIsEditing(false);
  };

  const updateField = (field: keyof Voyage, value: any) => {
    setEditedVoyage(prev => ({ ...prev, [field]: value }));
  };

  // Source URLs management
  const addSourceUrl = () => {
    if (newSourceUrl.trim()) {
      const updated = [...sourceUrls, newSourceUrl.trim()];
      setSourceUrls(updated);
      updateField('source_urls', updated as any);
      setNewSourceUrl("");
    }
  };

  const removeSourceUrl = (index: number) => {
    const updated = sourceUrls.filter((_, i) => i !== index);
    setSourceUrls(updated);
    updateField('source_urls', updated as any);
  };

  // Person search and linking
  const searchPeople = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/curator/people/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const linkPerson = async (personSlug: string, fullName: string) => {
    const role = prompt(`Enter role for ${fullName} on this voyage:`, "Passenger");
    if (!role) return;

    try {
      const response = await fetch('/api/curator/people/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: personSlug,
          voyage_slug: voyage.voyage_slug,
          capacity_role: role
        })
      });

      if (response.ok) {
        alert(`${fullName} linked successfully!`);
        setPersonSearch("");
        setSearchResults([]);
        // Reload people
        api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
      }
    } catch (error) {
      console.error('Link failed:', error);
      alert('Failed to link person');
    }
  };

  // Media upload
  const uploadMedia = async () => {
    if (!selectedFile) return;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('media_slug', `${voyage.voyage_slug}-${Date.now()}`);
      formData.append('voyage_slug', voyage.voyage_slug);
      formData.append('title', mediaTitle || selectedFile.name);
      formData.append('credit', mediaCredit);
      if (mediaDate) {
        formData.append('date', mediaDate);
      }

      const response = await fetch('/api/curator/media/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        alert('Media uploaded successfully!');
        setSelectedFile(null);
        setMediaTitle("");
        setMediaCredit("");
        setMediaDate("");
        // Reload media
        api.getVoyageMedia(voyage.voyage_slug).then(setMedia);
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Delete voyage
  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete voyage "${voyage.title || voyage.voyage_slug}"? This cannot be undone.`)) {
      return;
    }
    if (onDelete) {
      onDelete(voyage.voyage_slug);
    }
  };

  // Duplicate voyage
  const handleDuplicate = () => {
    const newSlug = prompt(`Enter slug for duplicated voyage:`, `${voyage.voyage_slug}-copy`);
    if (!newSlug) return;
    if (onDuplicate) {
      onDuplicate(newSlug);
    }
  };

  // Auto-computed fields (has_photo, has_video) - shown but not editable
  const autoComputedFields = [
    { key: 'has_photo' as keyof Voyage, label: 'Has Photos' },
    { key: 'has_video' as keyof Voyage, label: 'Has Video' },
  ];

  // Editable boolean fields
  const booleanFields = [
    { key: 'presidential_use' as keyof Voyage, label: 'Presidential Use' },
    { key: 'has_royalty' as keyof Voyage, label: 'Royalty Present' },
    { key: 'has_foreign_leader' as keyof Voyage, label: 'Foreign Leader Present' },
    { key: 'mention_camp_david' as keyof Voyage, label: 'Camp David' },
    { key: 'mention_mount_vernon' as keyof Voyage, label: 'Mount Vernon' },
    { key: 'mention_captain' as keyof Voyage, label: 'Captain' },
    { key: 'mention_crew' as keyof Voyage, label: 'Crew' },
    { key: 'mention_rmd' as keyof Voyage, label: 'RMD' },
    { key: 'mention_yacht_spin' as keyof Voyage, label: 'Yacht Spin' },
    { key: 'mention_menu' as keyof Voyage, label: 'Menu Info' },
    { key: 'mention_drinks_wine' as keyof Voyage, label: 'Drinks/Wine' },
  ];

  // Combine auto-computed and editable fields for display
  const allDisplayFields = [...autoComputedFields, ...booleanFields];

  const activeTags = allDisplayFields
    .filter(field => voyage[field.key] === true)
    .map(field => field.label);

  const currentVoyage = isEditing ? editedVoyage : voyage;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={currentVoyage.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              className="text-xl font-semibold w-full border rounded px-2 py-1"
              placeholder="Voyage Title"
            />
          ) : (
            <h3 className="text-xl font-semibold text-gray-900">
              {currentVoyage.title || `Voyage ${currentVoyage.voyage_slug}`}
            </h3>
          )}
        </div>

        {editMode && (
          <div className="ml-4">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Edit
                </button>
                {onDuplicate && (
                  <button
                    onClick={handleDuplicate}
                    className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                  >
                    Duplicate
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Type */}
      {currentVoyage.voyage_type && (
        <div className="mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 font-medium capitalize text-sm">
            {currentVoyage.voyage_type}
          </span>
        </div>
      )}

      {/* Date and Time Information */}
      {isEditing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={currentVoyage.start_date || ''}
              onChange={(e) => updateField('start_date', e.target.value || null)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <label className="block text-xs font-medium text-gray-700 mt-2">Start Location</label>
            <input
              type="text"
              value={currentVoyage.start_location || currentVoyage.origin || ''}
              onChange={(e) => updateField('start_location', e.target.value || null)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="e.g., Washington, DC"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={currentVoyage.end_date || ''}
              onChange={(e) => updateField('end_date', e.target.value || null)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <label className="block text-xs font-medium text-gray-700 mt-2">End Location</label>
            <input
              type="text"
              value={currentVoyage.end_location || currentVoyage.destination || ''}
              onChange={(e) => updateField('end_location', e.target.value || null)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="e.g., Annapolis, MD"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <strong className="text-gray-900">Start:</strong>
            <div className="text-gray-700">
              {formatDateTime(currentVoyage.start_timestamp) || formatDate(currentVoyage.start_date)}
            </div>
            {(currentVoyage.start_location || currentVoyage.origin) && (
              <div className="text-gray-600 text-xs mt-1">
                {currentVoyage.start_location || currentVoyage.origin}
              </div>
            )}
          </div>

          <div>
            <strong className="text-gray-900">End:</strong>
            <div className="text-gray-700">
              {formatDateTime(currentVoyage.end_timestamp) || formatDate(currentVoyage.end_date)}
            </div>
            {(currentVoyage.end_location || currentVoyage.destination) && (
              <div className="text-gray-600 text-xs mt-1">
                {currentVoyage.end_location || currentVoyage.destination}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Boolean Attributes */}
      {/* Voyage Attributes */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Voyage Attributes</h4>

        {isEditing ? (
          <div className="space-y-2">
            {/* Auto-computed fields (read-only) */}
            {autoComputedFields.map(field => (
              <div key={field.key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={currentVoyage[field.key] === true}
                  disabled
                  className="mr-2 opacity-50 cursor-not-allowed"
                />
                <label className="text-sm text-gray-500 italic">{field.label} (auto-computed)</label>
              </div>
            ))}

            {/* Editable boolean fields */}
            {booleanFields.map(field => (
              <div key={field.key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={currentVoyage[field.key] === true}
                  onChange={(e) => updateField(field.key, e.target.checked)}
                  className="mr-2"
                />
                <label className="text-sm text-gray-700">{field.label}</label>
              </div>
            ))}
          </div>
        ) : (
          activeTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeTags.map((tag, idx) => (
                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          )
        )}
      </div>

      {/* Summary */}
      {currentVoyage.summary_markdown && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Summary</h4>
          {isEditing ? (
            <textarea
              value={currentVoyage.summary_markdown}
              onChange={(e) => updateField('summary_markdown', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={4}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {stripMarkdown(currentVoyage.summary_markdown)}
            </p>
          )}
        </div>
      )}

      {/* Additional Information */}
      {currentVoyage.additional_information && (
        <div className="mb-4 bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Additional Information</h4>
          {isEditing ? (
            <textarea
              value={currentVoyage.additional_information}
              onChange={(e) => updateField('additional_information', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={3}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {currentVoyage.additional_information}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      {currentVoyage.notes_internal && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Notes</h4>
          {isEditing ? (
            <textarea
              value={currentVoyage.notes_internal}
              onChange={(e) => updateField('notes_internal', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={2}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {currentVoyage.notes_internal}
            </p>
          )}
        </div>
      )}

      {/* Source URLs */}
      {isEditing || (currentVoyage.source_urls && currentVoyage.source_urls.length > 0) ? (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Source URLs</h4>
          {isEditing ? (
            <div className="space-y-2">
              {sourceUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={url}
                    readOnly
                    className="flex-1 border rounded px-2 py-1 bg-gray-50 text-xs"
                  />
                  <button
                    onClick={() => removeSourceUrl(index)}
                    className="text-red-600 hover:text-red-800 text-xs px-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSourceUrl()}
                  placeholder="https://..."
                  className="flex-1 border rounded px-2 py-1 text-xs"
                />
                <button
                  onClick={addSourceUrl}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-xs"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {currentVoyage.source_urls?.map((source, index) => (
                <li key={index} className="text-sm text-gray-700">
                  {source.startsWith('http') ? (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                    >
                      {source}
                    </a>
                  ) : (
                    <span>• {source}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* People */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">People ({people.length})</h4>

        {/* Person Search (Edit Mode Only) */}
        {isEditing && (
          <div className="mb-4 bg-blue-50 p-3 rounded">
            <label className="block text-xs font-medium text-gray-700 mb-1">Search & Link People</label>
            <input
              type="text"
              value={personSearch}
              onChange={(e) => {
                setPersonSearch(e.target.value);
                searchPeople(e.target.value);
              }}
              placeholder="Search by name..."
              className="w-full border rounded px-2 py-1 text-sm"
            />
            {searching && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {searchResults.map(person => (
                  <div
                    key={person.person_slug}
                    onClick={() => linkPerson(person.person_slug, person.full_name)}
                    className="p-2 bg-white border rounded hover:bg-gray-50 cursor-pointer text-xs"
                  >
                    <div className="font-medium">{person.full_name}</div>
                    {person.role_title && <div className="text-gray-600">{person.role_title}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loadingPeople ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-gray-600">No people recorded for this voyage.</p>
        ) : (
          <ul className="space-y-2">
            {people.map((p) => {
              const bioLink = p.bio || p.wikipedia_url;
              const roleToDisplay = p.capacity_role || p.role_title || p.title;

              return (
                <li key={p.person_slug} className="flex items-start gap-2 text-sm">
                  <span className="mt-1">•</span>
                  <div>
                    <div className="font-medium">
                      {bioLink ? (
                        <a
                          href={bioLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {p.full_name}
                        </a>
                      ) : (
                        p.full_name
                      )}
                    </div>
                    {roleToDisplay && (
                      <div className="text-gray-700 text-xs">{roleToDisplay}</div>
                    )}
                    {p.voyage_notes && (
                      <div className="text-gray-600 text-xs mt-1">{p.voyage_notes}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Media Gallery */}
      {(isEditing || media.filter(m => m.s3_url?.includes('sequoia-canonical')).length > 0) && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Media ({media.filter(m => m.s3_url?.includes('sequoia-canonical')).length})</h4>

          {/* Media Upload (Edit Mode Only) */}
          {isEditing && (
            <div className="mb-4 bg-green-50 p-3 rounded">
              <label className="block text-xs font-medium text-gray-700 mb-1">Upload Media</label>
              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                accept="image/*,video/*,application/pdf"
                className="w-full text-xs mb-2"
              />
              {selectedFile && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    value={mediaCredit}
                    onChange={(e) => setMediaCredit(e.target.value)}
                    placeholder="Credit/Source"
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                  <input
                    type="date"
                    value={mediaDate}
                    onChange={(e) => setMediaDate(e.target.value)}
                    placeholder="Date"
                    className="w-full border rounded px-2 py-1 text-xs"
                  />
                  <button
                    onClick={uploadMedia}
                    disabled={uploadingMedia}
                    className="w-full bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs disabled:opacity-50"
                  >
                    {uploadingMedia ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              )}
            </div>
          )}

          {loadingMedia ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <MediaGallery voyageSlug={currentVoyage.voyage_slug} />
          )}
        </div>
      )}
    </div>
  );
};

export default VoyageCardExpanded;
