import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Voyage, Person, MediaItem } from "../types";
import { api } from "../api";
import MediaGallery from "./MediaGallery";
import MediaSearchModal from "./MediaSearchModal";
import MediaUploadDialog from "./MediaUploadDialog";

interface VoyageCardExpandedProps {
  voyage: Voyage;
  editMode: boolean;
  onSave?: (voyage: Voyage) => void;
  onDelete?: (voyageSlug: string) => void;
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

const VoyageCardExpanded: React.FC<VoyageCardExpandedProps> = ({ voyage, editMode, onSave, onDelete }) => {
  const [editedVoyage, setEditedVoyage] = useState<Voyage>(voyage);
  const [isEditing, setIsEditing] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Source URLs state
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");

  // Additional Source URLs state
  const [additionalSourceUrls, setAdditionalSourceUrls] = useState<string[]>([]);
  const [newAdditionalSourceUrl, setNewAdditionalSourceUrl] = useState("");

  // Person search state
  const [personSearch, setPersonSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  // Media modal state
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showSourceMediaUpload, setShowSourceMediaUpload] = useState(false);
  const [showAdditionalSourceMediaUpload, setShowAdditionalSourceMediaUpload] = useState(false);
  const [showSourceMediaSearch, setShowSourceMediaSearch] = useState(false);
  const [showAdditionalSourceMediaSearch, setShowAdditionalSourceMediaSearch] = useState(false);

  // Media loading function
  const loadMedia = () => {
    setLoadingMedia(true);
    api.getVoyageMedia(voyage.voyage_slug)
      .then(setMedia)
      .catch(() => setMedia([]))
      .finally(() => setLoadingMedia(false));
  };

  // Person edit modal state
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [personFormData, setPersonFormData] = useState<{
    full_name: string;
    role_title: string;
    bio: string;
    capacity_role: string;
    is_crew: boolean;
  }>({
    full_name: '',
    role_title: '',
    bio: '',
    capacity_role: '',
    is_crew: false
  });

  // Compute media by category
  const sourceMedia = media.filter(m => m.media_category === 'source');
  const additionalSourceMedia = media.filter(m => m.media_category === 'additional_source');

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

    // Initialize additional source URLs
    if (voyage.additional_sources) {
      const additionalUrls = voyage.additional_sources.split('\n').filter((s: string) => s.trim());
      setAdditionalSourceUrls(additionalUrls);
    }
  }, [voyage.voyage_slug, voyage.source_urls, voyage.additional_sources]);

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

  // Additional source URLs management
  const addAdditionalSourceUrl = () => {
    if (newAdditionalSourceUrl.trim()) {
      const updated = [...additionalSourceUrls, newAdditionalSourceUrl.trim()];
      setAdditionalSourceUrls(updated);
      updateField('additional_sources', updated.join('\n'));
      setNewAdditionalSourceUrl("");
    }
  };

  const removeAdditionalSourceUrl = (index: number) => {
    const updated = additionalSourceUrls.filter((_, i) => i !== index);
    setAdditionalSourceUrls(updated);
    updateField('additional_sources', updated.join('\n'));
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

  const createAndLinkNewPerson = async () => {
    const fullName = prompt("Enter person's full name:");
    if (!fullName || !fullName.trim()) return;

    const role = prompt(`Enter role for ${fullName} on this voyage:`, "Passenger");
    if (!role) return;

    const bioUrl = prompt(`Enter bio/Wikipedia URL for ${fullName} (optional):`, "");
    const isCrew = confirm(`Is ${fullName} crew? (Click OK for crew, Cancel for passenger/guest)`);

    try {
      // Create the person
      const createResponse = await fetch('/api/curator/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: 'auto', // Auto-generate from name
          full_name: fullName.trim(),
          role_title: role,
          organization: null,
          birth_year: null,
          death_year: null,
          wikipedia_url: bioUrl?.trim() || null,
          notes_internal: null,
          tags: null
        })
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.detail || 'Failed to create person');
      }

      const newPerson = await createResponse.json();

      // Link to voyage
      const linkResponse = await fetch('/api/curator/people/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: newPerson.person_slug,
          voyage_slug: voyage.voyage_slug,
          capacity_role: role,
          is_crew: isCrew,
          notes: null
        })
      });

      if (linkResponse.ok) {
        alert(`${fullName} created and linked successfully!`);
        setPersonSearch("");
        setSearchResults([]);
        // Reload people
        api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
      } else {
        alert(`Person created but failed to link to voyage`);
      }
    } catch (error) {
      console.error('Create/link failed:', error);
      alert(`Failed to create person: ${error}`);
    }
  };

  const linkPerson = async (personSlug: string, fullName: string) => {
    const role = prompt(`Enter role for ${fullName} on this voyage:`, "Passenger");
    if (!role) return;

    const isCrew = confirm(`Is ${fullName} crew? (Click OK for crew, Cancel for passenger/guest)`);

    try {
      const response = await fetch('/api/curator/people/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: personSlug,
          voyage_slug: voyage.voyage_slug,
          capacity_role: role,
          is_crew: isCrew,
          notes: null
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

  // Open edit modal for a person
  const openEditPerson = (person: Person) => {
    setEditingPerson(person);
    setPersonFormData({
      full_name: person.full_name || '',
      role_title: person.role_title || person.role || '',
      bio: person.bio || person.wikipedia_url || '',
      capacity_role: person.capacity_role || '',
      is_crew: person.is_crew || false
    });
  };

  // Save edited person
  const saveEditedPerson = async () => {
    if (!editingPerson) return;

    try {
      // Update the person record (global)
      const personResponse = await fetch(`/api/curator/people/${editingPerson.person_slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: editingPerson.person_slug,
          full_name: personFormData.full_name,
          role_title: personFormData.role_title,
          organization: editingPerson.organization || null,
          birth_year: editingPerson.birth_year || null,
          death_year: editingPerson.death_year || null,
          wikipedia_url: personFormData.bio || null,
          notes_internal: editingPerson.notes_internal || null,
          tags: editingPerson.tags || null
        })
      });

      if (!personResponse.ok) {
        throw new Error('Failed to update person');
      }

      // Update the voyage-specific link (capacity_role and is_crew)
      const linkResponse = await fetch('/api/curator/people/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: editingPerson.person_slug,
          voyage_slug: voyage.voyage_slug,
          capacity_role: personFormData.capacity_role,
          is_crew: personFormData.is_crew,
          notes: editingPerson.voyage_notes || null
        })
      });

      if (linkResponse.ok) {
        alert('Person updated successfully!');
        setEditingPerson(null);
        // Reload people to show updated info
        api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
      } else {
        alert('Person updated but failed to update voyage link');
      }
    } catch (error) {
      console.error('Update failed:', error);
      alert(`Failed to update person: ${error}`);
    }
  };

  // Media workflow handlers
  const handleMediaLinkFromSearch = async (media: any) => {
    try {
      const response = await fetch('/api/curator/media/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_slug: media.media_slug,
          voyage_slug: voyage.voyage_slug,
          sort_order: null,
          notes: ""
        })
      });

      if (response.ok) {
        // Reload media
        loadMedia();
      } else {
        alert('Failed to link media to voyage');
      }
    } catch (error) {
      console.error('Link failed:', error);
      alert('Failed to link media');
    }
  };

  const handleMediaUploadSuccess = (mediaSlug: string) => {
    // Reload media after successful upload
    loadMedia();
  };

  const handleAttachSourceMedia = async (media: any) => {
    try {
      const response = await fetch('/api/curator/media/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_slug: media.media_slug,
          voyage_slug: voyage.voyage_slug,
          media_category: 'source',
          sort_order: null,
          notes: ''
        })
      });

      if (response.ok) {
        loadMedia();
      } else {
        alert('Failed to attach media');
      }
    } catch (error) {
      console.error('Error attaching media:', error);
      alert('Failed to attach media');
    }
  };

  const handleAttachAdditionalSourceMedia = async (media: any) => {
    try {
      const response = await fetch('/api/curator/media/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_slug: media.media_slug,
          voyage_slug: voyage.voyage_slug,
          media_category: 'additional_source',
          sort_order: null,
          notes: ''
        })
      });

      if (response.ok) {
        loadMedia();
      } else {
        alert('Failed to attach media');
      }
    } catch (error) {
      console.error('Error attaching media:', error);
      alert('Failed to attach media');
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
      {isEditing ? (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Voyage Type</label>
          <select
            value={currentVoyage.voyage_type || ''}
            onChange={(e) => updateField('voyage_type', e.target.value || null)}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="">-- None --</option>
            <option value="official">Official</option>
            <option value="private">Private</option>
            <option value="maintenance">Maintenance</option>
            <option value="other">Other</option>
          </select>
        </div>
      ) : (
        currentVoyage.voyage_type && currentVoyage.voyage_type.toLowerCase() !== 'unknown' && (
          <div className="mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 font-medium capitalize text-sm">
              {currentVoyage.voyage_type}
            </span>
          </div>
        )
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

      {/* Sources */}
      {isEditing || (currentVoyage.source_urls && currentVoyage.source_urls.length > 0) ? (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Sources</h4>
          {isEditing ? (
            <div className="space-y-3">
              {/* Text/URL Sources */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Text/URL Sources:</label>
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
                      placeholder="URL or source name (e.g., National Archives or https://...)"
                      className="flex-1 border rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={addSourceUrl}
                      className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-xs"
                    >
                      Add Text
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Source Media */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowSourceMediaUpload(true)}
                  className="w-full bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-xs font-medium"
                >
                  📎 Upload New Source Media
                </button>
                <button
                  onClick={() => setShowSourceMediaSearch(true)}
                  className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-xs font-medium"
                >
                  🔍 Attach Existing Media as Source
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {currentVoyage.source_urls?.map((source, index) => {
                const isUrl = source.startsWith('http://') || source.startsWith('https://');
                if (isUrl) {
                  // Extract readable name from URL (domain or path)
                  let displayName = source;
                  try {
                    const url = new URL(source);
                    displayName = url.hostname.replace('www.', '') + (url.pathname !== '/' ? url.pathname.substring(0, 30) + '...' : '');
                  } catch {}

                  return (
                    <li key={index} className="text-sm">
                      <a
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                      >
                        🔗 {displayName}
                      </a>
                    </li>
                  );
                } else {
                  return (
                    <li key={index} className="text-sm text-gray-700">
                      • {source}
                    </li>
                  );
                }
              })}
            </ul>
          )}
        </div>
      ) : null}

      {/* Additional Sources */}
      {isEditing || (currentVoyage.additional_sources && currentVoyage.additional_sources.trim()) ? (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Additional Sources</h4>
          {isEditing ? (
            <div className="space-y-3">
              {/* Text/URL Additional Sources */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Text/URL Additional Sources:</label>
                <div className="space-y-2">
                  {additionalSourceUrls.map((url, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={url}
                        readOnly
                        className="flex-1 border rounded px-2 py-1 bg-gray-50 text-xs"
                      />
                      <button
                        onClick={() => removeAdditionalSourceUrl(index)}
                        className="text-red-600 hover:text-red-800 text-xs px-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newAdditionalSourceUrl}
                      onChange={(e) => setNewAdditionalSourceUrl(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAdditionalSourceUrl()}
                      placeholder="Additional reference or URL..."
                      className="flex-1 border rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={addAdditionalSourceUrl}
                      className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-xs"
                    >
                      Add Text
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Additional Source Media */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowAdditionalSourceMediaUpload(true)}
                  className="w-full bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 text-xs font-medium"
                >
                  📎 Upload New Additional Source Media
                </button>
                <button
                  onClick={() => setShowAdditionalSourceMediaSearch(true)}
                  className="w-full bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 text-xs font-medium"
                >
                  🔍 Attach Existing Media as Additional Source
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {currentVoyage.additional_sources?.split('\n').filter(s => s.trim()).map((source, index) => {
                const trimmed = source.trim();
                const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
                if (isUrl) {
                  let displayName = trimmed;
                  try {
                    const url = new URL(trimmed);
                    displayName = url.hostname.replace('www.', '') + (url.pathname !== '/' ? url.pathname.substring(0, 30) + '...' : '');
                  } catch {}

                  return (
                    <div key={index} className="text-sm">
                      <a
                        href={trimmed}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-800 hover:underline inline-flex items-center gap-1"
                      >
                        🔗 {displayName}
                      </a>
                    </div>
                  );
                } else {
                  return (
                    <div key={index} className="text-sm text-gray-700">
                      • {trimmed}
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* People */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">People ({people.length})</h4>

        {/* Person Search (Edit Mode Only) */}
        {isEditing && (
          <div className="mb-4 bg-blue-50 p-3 rounded">
            <label className="block text-xs font-medium text-gray-700 mb-1">Add People to Voyage</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={personSearch}
                onChange={(e) => {
                  setPersonSearch(e.target.value);
                  searchPeople(e.target.value);
                }}
                placeholder="Search by name..."
                className="flex-1 border rounded px-2 py-1 text-sm"
              />
              <button
                onClick={createAndLinkNewPerson}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs whitespace-nowrap"
              >
                + Create New
              </button>
            </div>
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
          <div className="space-y-6">
            {/* Crew Section */}
            {(() => {
              const crew = people.filter(p => p.is_crew === true);
              return crew.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase">Crew ({crew.length})</h4>
                  <ul className="space-y-2">
                    {crew.map((p) => {
                      const bioLink = p.bio || p.wikipedia_url;
                      const roleToDisplay = p.capacity_role || p.role_title || p.title;
                      return (
                        <li key={p.person_slug} className="flex items-start gap-2 bg-blue-50 p-2 rounded">
                          <span className="mt-1">•</span>
                          <div className="flex-1 text-sm">
                            <div className="font-medium">
                              {bioLink ? (
                                <a href={bioLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {p.full_name}
                                </a>
                              ) : (
                                p.full_name
                              )}
                            </div>
                            {roleToDisplay && <div className="text-gray-700">{roleToDisplay}</div>}
                            {p.voyage_notes && <div className="text-gray-600 text-xs mt-1">{p.voyage_notes}</div>}
                          </div>
                          {isEditing && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => openEditPerson(p)}
                                className="text-lg hover:scale-110 transition-transform"
                                title="Edit person"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${p.full_name} from this voyage?`)) return;
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/unlink-from-voyage?person_slug=${encodeURIComponent(p.person_slug)}&voyage_slug=${encodeURIComponent(voyage.voyage_slug)}`,
                                      { method: 'DELETE' }
                                    );
                                    if (response.ok) {
                                      const result = await response.json();
                                      if (result.person_deleted) {
                                        alert(`${p.full_name} removed and deleted (no other voyages)`);
                                      }
                                      api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
                                    } else {
                                      alert('Failed to remove person');
                                    }
                                  } catch (error) {
                                    console.error('Remove failed:', error);
                                    alert('Failed to remove person');
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 hover:scale-110 transition-transform text-lg"
                                title="Remove from voyage"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null;
            })()}

            {/* Passengers & Guests Section */}
            {(() => {
              const passengers = people.filter(p => p.is_crew !== true);
              return passengers.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase">Passengers & Guests ({passengers.length})</h4>
                  <ul className="space-y-2">
                    {passengers.map((p) => {
                      const bioLink = p.bio || p.wikipedia_url;
                      const roleToDisplay = p.capacity_role || p.role_title || p.title;
                      return (
                        <li key={p.person_slug} className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <div className="flex-1 text-sm">
                            <div className="font-medium">
                              {bioLink ? (
                                <a href={bioLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {p.full_name}
                                </a>
                              ) : (
                                p.full_name
                              )}
                            </div>
                            {roleToDisplay && <div className="text-gray-700">{roleToDisplay}</div>}
                            {p.voyage_notes && <div className="text-gray-600 text-xs mt-1">{p.voyage_notes}</div>}
                          </div>
                          {isEditing && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => openEditPerson(p)}
                                className="text-lg hover:scale-110 transition-transform"
                                title="Edit person"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${p.full_name} from this voyage?`)) return;
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/unlink-from-voyage?person_slug=${encodeURIComponent(p.person_slug)}&voyage_slug=${encodeURIComponent(voyage.voyage_slug)}`,
                                      { method: 'DELETE' }
                                    );
                                    if (response.ok) {
                                      const result = await response.json();
                                      if (result.person_deleted) {
                                        alert(`${p.full_name} removed and deleted (no other voyages)`);
                                      }
                                      api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
                                    } else {
                                      alert('Failed to remove person');
                                    }
                                  } catch (error) {
                                    console.error('Remove failed:', error);
                                    alert('Failed to remove person');
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 hover:scale-110 transition-transform text-lg"
                                title="Remove from voyage"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Sources - Media Files */}
      {(() => {
        return sourceMedia.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Source Media ({sourceMedia.length})</h4>
            <div className="space-y-3">
              {sourceMedia.map((source) => {
                const captionParts: string[] = [];
                if (source.date) captionParts.push(source.date);
                if (source.credit) captionParts.push(source.credit);
                if (source.description_markdown) captionParts.push(source.description_markdown);
                const caption = captionParts.join(' — ') || source.title || 'Source Document';

                return (
                  <div key={source.media_slug} className="border border-blue-200 rounded-lg p-4 hover:bg-blue-50 transition-colors bg-blue-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 mb-2">📎 {caption}</p>
                        <div className="flex gap-2 items-center">
                          <a
                            href={source.url || source.s3_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            View Source →
                          </a>
                          {isEditing && (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    await fetch('/api/curator/media/link-to-voyage', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        media_slug: source.media_slug,
                                        voyage_slug: voyage.voyage_slug,
                                        media_category: 'additional_source',
                                        sort_order: null,
                                        notes: ''
                                      })
                                    });
                                    loadMedia();
                                  } catch (error) {
                                    console.error('Move failed:', error);
                                    alert('Failed to move media');
                                  }
                                }}
                                className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
                                title="Move to Additional Sources"
                              >
                                → Additional
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('Remove this media from voyage?')) return;
                                  try {
                                    await fetch(
                                      `/api/curator/media/unlink-from-voyage?media_slug=${encodeURIComponent(source.media_slug)}&voyage_slug=${encodeURIComponent(voyage.voyage_slug)}`,
                                      { method: 'DELETE' }
                                    );
                                    loadMedia();
                                  } catch (error) {
                                    console.error('Detach failed:', error);
                                    alert('Failed to detach media');
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Remove from voyage"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Additional Sources - Media Files */}
      {(() => {
        return additionalSourceMedia.length > 0 && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Additional Source Media ({additionalSourceMedia.length})</h4>
            <div className="space-y-3">
              {additionalSourceMedia.map((source) => {
                const captionParts: string[] = [];
                if (source.date) captionParts.push(source.date);
                if (source.credit) captionParts.push(source.credit);
                if (source.description_markdown) captionParts.push(source.description_markdown);
                const caption = captionParts.join(' — ') || source.title || 'Additional Source Document';

                return (
                  <div key={source.media_slug} className="border border-purple-200 rounded-lg p-4 hover:bg-purple-50 transition-colors bg-purple-50">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 mb-2">📎 {caption}</p>
                        <div className="flex gap-2 items-center">
                          <a
                            href={source.url || source.s3_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 hover:underline"
                          >
                            View Source →
                          </a>
                          {isEditing && (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    await fetch('/api/curator/media/link-to-voyage', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        media_slug: source.media_slug,
                                        voyage_slug: voyage.voyage_slug,
                                        media_category: 'source',
                                        sort_order: null,
                                        notes: ''
                                      })
                                    });
                                    loadMedia();
                                  } catch (error) {
                                    console.error('Move failed:', error);
                                    alert('Failed to move media');
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                title="Move to Sources"
                              >
                                ← Sources
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('Remove this media from voyage?')) return;
                                  try {
                                    await fetch(
                                      `/api/curator/media/unlink-from-voyage?media_slug=${encodeURIComponent(source.media_slug)}&voyage_slug=${encodeURIComponent(voyage.voyage_slug)}`,
                                      { method: 'DELETE' }
                                    );
                                    loadMedia();
                                  } catch (error) {
                                    console.error('Detach failed:', error);
                                    alert('Failed to detach media');
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Remove from voyage"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Media Upload Dialog - Sources */}
      <MediaUploadDialog
        isOpen={showSourceMediaUpload}
        onClose={() => setShowSourceMediaUpload(false)}
        onSuccess={handleMediaUploadSuccess}
        voyageSlug={voyage.voyage_slug}
        autoLinkToVoyage={true}
        mediaCategory="source"
      />

      {/* Media Upload Dialog - Additional Sources */}
      <MediaUploadDialog
        isOpen={showAdditionalSourceMediaUpload}
        onClose={() => setShowAdditionalSourceMediaUpload(false)}
        onSuccess={handleMediaUploadSuccess}
        voyageSlug={voyage.voyage_slug}
        autoLinkToVoyage={true}
        mediaCategory="additional_source"
      />

      {/* Media Search Modal - Sources */}
      <MediaSearchModal
        isOpen={showSourceMediaSearch}
        onClose={() => setShowSourceMediaSearch(false)}
        onSelect={handleAttachSourceMedia}
        excludeMediaSlugs={sourceMedia.map(m => m.media_slug)}
      />

      {/* Media Search Modal - Additional Sources */}
      <MediaSearchModal
        isOpen={showAdditionalSourceMediaSearch}
        onClose={() => setShowAdditionalSourceMediaSearch(false)}
        onSelect={handleAttachAdditionalSourceMedia}
        excludeMediaSlugs={additionalSourceMedia.map(m => m.media_slug)}
      />

      {/* Person Edit Modal */}
      {editingPerson && (
        <div className="fixed z-50 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setEditingPerson(null)}></div>

            {/* Center modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                      Edit Person: {editingPerson.full_name}
                    </h3>

                    <div className="space-y-4">
                      {/* Full Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={personFormData.full_name}
                          onChange={(e) => setPersonFormData({ ...personFormData, full_name: e.target.value })}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>

                      {/* General Role/Title */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          General Role/Title <span className="text-gray-500 text-xs">(applies to all voyages)</span>
                        </label>
                        <input
                          type="text"
                          value={personFormData.role_title}
                          onChange={(e) => setPersonFormData({ ...personFormData, role_title: e.target.value })}
                          placeholder="e.g., Secretary of State, Admiral, etc."
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Capacity Role on This Voyage */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role on This Voyage <span className="text-gray-500 text-xs">(specific to this voyage only)</span>
                        </label>
                        <input
                          type="text"
                          value={personFormData.capacity_role}
                          onChange={(e) => setPersonFormData({ ...personFormData, capacity_role: e.target.value })}
                          placeholder="e.g., Guest, Passenger, etc."
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Bio/Wikipedia URL */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio/Wikipedia URL</label>
                        <input
                          type="text"
                          value={personFormData.bio}
                          onChange={(e) => setPersonFormData({ ...personFormData, bio: e.target.value })}
                          placeholder="https://..."
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        />
                      </div>

                      {/* Is Crew Checkbox */}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="is_crew"
                          checked={personFormData.is_crew}
                          onChange={(e) => setPersonFormData({ ...personFormData, is_crew: e.target.checked })}
                          className="mr-2 h-4 w-4"
                        />
                        <label htmlFor="is_crew" className="text-sm font-medium text-gray-700">
                          Is Crew Member <span className="text-gray-500 text-xs">(on this voyage)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={saveEditedPerson}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setEditingPerson(null)}
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

export default VoyageCardExpanded;
