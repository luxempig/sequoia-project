import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { Voyage, Person, MediaItem } from "../types";
import { api } from "../api";
import MediaGallery from "./MediaGallery";
import MediaSearchModal from "./MediaSearchModal";
import MediaUploadDialog from "./MediaUploadDialog";
import AlbumManager from "./AlbumManager";

interface VoyageCardExpandedProps {
  voyage: Voyage;
  editMode: boolean;
  onSave?: (voyage: Voyage) => void;
  onDelete?: (voyageSlug: string) => void;
}

// Helper function to format date input with auto-separators
const formatDateInput = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 4) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  } else {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
  }
};

// Helper function to format time input with auto-separator (HH:MM)
const formatTimeInput = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 0) return '';
  if (numbers.length <= 2) {
    const hours = Math.min(23, parseInt(numbers) || 0);
    return hours.toString().padStart(numbers.length, '0');
  } else if (numbers.length === 3) {
    // Don't pad minutes yet - let user continue typing
    const hours = Math.min(23, parseInt(numbers.slice(0, 2)) || 0);
    const mins = parseInt(numbers.slice(2, 3)) || 0;
    return `${hours.toString().padStart(2, '0')}:${mins}`;
  } else {
    const hours = Math.min(23, parseInt(numbers.slice(0, 2)) || 0);
    const mins = Math.min(59, parseInt(numbers.slice(2, 4)) || 0);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    // Use dayjs to parse date string without timezone conversion
    return dayjs(iso).format('MMM D, YYYY');
  } catch {
    return iso;
  }
};

const formatDateTime = (timestamp: string | null | undefined) => {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      });
    }
    // If invalid, try to replace T with space in ISO format
    return timestamp.replace('T', ' ');
  } catch {
    // Fallback: replace T with space
    return timestamp.replace('T', ' ');
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

  // Helper function to get media type icon
  const getMediaIcon = (type: string | null | undefined) => {
    switch (type) {
      case 'article': return '📄';
      case 'document': return '📃';
      case 'logbook': return '📓';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'book': return '📚';
      case 'pdf': return '📄'; // Legacy support
      default: return '📎';
    }
  };

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

  // Create new person form state
  const [showCreatePersonForm, setShowCreatePersonForm] = useState(false);
  const [newPersonData, setNewPersonData] = useState({
    full_name: '',
    role_title: '',
    bio_url: '',
    is_crew: false
  });

  // Media modal state
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showSourceMediaUpload, setShowSourceMediaUpload] = useState(false);
  const [showAdditionalSourceMediaUpload, setShowAdditionalSourceMediaUpload] = useState(false);
  const [showSourceMediaSearch, setShowSourceMediaSearch] = useState(false);
  const [showAdditionalSourceMediaSearch, setShowAdditionalSourceMediaSearch] = useState(false);

  // Lightbox state for viewing media
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Collapse state for passenger sections
  const [crewCollapsed, setCrewCollapsed] = useState(false);
  const [passengersCollapsed, setPassengersCollapsed] = useState(false);

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
    if (!newPersonData.full_name.trim()) return;

    try {
      // Create the person
      const createResponse = await fetch('/api/curator/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: 'auto',
          full_name: newPersonData.full_name.trim(),
          role_title: newPersonData.role_title || null,
          organization: null,
          birth_year: null,
          death_year: null,
          wikipedia_url: newPersonData.bio_url?.trim() || null,
          notes_internal: null,
          tags: null
        })
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error('Failed to create person:', error.detail);
        return;
      }

      const newPerson = await createResponse.json();

      // Link to voyage
      const linkResponse = await fetch('/api/curator/people/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: newPerson.person_slug,
          voyage_slug: voyage.voyage_slug,
          capacity_role: null,
          is_crew: newPersonData.is_crew,
          notes: null
        })
      });

      if (linkResponse.ok) {
        setShowCreatePersonForm(false);
        setNewPersonData({ full_name: '', role_title: '', bio_url: '', is_crew: false });
        setPersonSearch("");
        setSearchResults([]);
        api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
      }
    } catch (error) {
      console.error('Create/link failed:', error);
    }
  };

  const linkPerson = async (personSlug: string, isCrew: boolean) => {
    try {
      const response = await fetch('/api/curator/people/link-to-voyage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: personSlug,
          voyage_slug: voyage.voyage_slug,
          capacity_role: null,
          is_crew: isCrew,
          notes: null
        })
      });

      if (response.ok) {
        setPersonSearch("");
        setSearchResults([]);
        api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
      }
    } catch (error) {
      console.error('Link failed:', error);
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
        setEditingPerson(null);
        api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
      }
    } catch (error) {
      console.error('Update failed:', error);
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
        loadMedia();
      }
    } catch (error) {
      console.error('Link failed:', error);
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
      }
    } catch (error) {
      console.error('Error attaching media:', error);
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
      }
    } catch (error) {
      console.error('Error attaching media:', error);
    }
  };

  const handleDetachMedia = async (mediaSlug: string, category: string) => {
    try {
      const response = await fetch(`/api/curator/media/unlink-from-voyage?media_slug=${mediaSlug}&voyage_slug=${voyage.voyage_slug}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadMedia();
      }
    } catch (error) {
      console.error('Failed to remove media:', error);
    }
  };

  // Delete voyage
  const handleDelete = () => {
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
    <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-5 mb-6 max-w-5xl mx-auto space-y-6">
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
            <label className="block text-xs font-medium text-gray-700">Start Date (YYYY-MM-DD)</label>
            <input
              type="text"
              value={currentVoyage.start_date || ''}
              onChange={(e) => {
                const formatted = formatDateInput(e.target.value);
                updateField('start_date', formatted || null);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />
            <label className="block text-xs font-medium text-gray-700 mt-2">Start Time (HH:MM)</label>
            <input
              type="text"
              value={currentVoyage.start_time || ''}
              onChange={(e) => {
                const formatted = formatTimeInput(e.target.value);
                updateField('start_time', formatted || null);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="HH:MM (24-hour)"
              maxLength={5}
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
            <label className="block text-xs font-medium text-gray-700">End Date (YYYY-MM-DD)</label>
            <input
              type="text"
              value={currentVoyage.end_date || ''}
              onChange={(e) => {
                const formatted = formatDateInput(e.target.value);
                updateField('end_date', formatted || null);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="YYYY-MM-DD"
              maxLength={10}
            />
            <label className="block text-xs font-medium text-gray-700 mt-2">End Time (HH:MM)</label>
            <input
              type="text"
              value={currentVoyage.end_time || ''}
              onChange={(e) => {
                const formatted = formatTimeInput(e.target.value);
                updateField('end_time', formatted || null);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="HH:MM (24-hour)"
              maxLength={5}
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
              {currentVoyage.has_photo && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">Photo(s)</span>}
              {currentVoyage.has_video && <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md">Video(s)</span>}
              {currentVoyage.presidential_use && currentVoyage.presidential_initials && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md">{currentVoyage.presidential_initials}</span>}
              {currentVoyage.has_royalty && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-md">Royalty{currentVoyage.royalty_details ? `: ${currentVoyage.royalty_details}` : ''}</span>}
              {currentVoyage.has_foreign_leader && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-md">Foreign Leader{currentVoyage.foreign_leader_country ? ` - ${currentVoyage.foreign_leader_country}` : ''}</span>}
              {currentVoyage.mention_camp_david && <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-md">CD</span>}
              {currentVoyage.mention_mount_vernon && <span className="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-md">MV</span>}
              {currentVoyage.mention_captain && <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-md">Captain</span>}
              {currentVoyage.mention_crew && <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-md">Crew</span>}
              {currentVoyage.mention_rmd && <span className="px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-md">RMD</span>}
              {currentVoyage.mention_yacht_spin && <span className="px-2 py-1 bg-lime-100 text-lime-800 text-xs rounded-md">Yacht Spin</span>}
              {currentVoyage.mention_menu && <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md">Menu</span>}
              {currentVoyage.mention_drinks_wine && <span className="px-2 py-1 bg-rose-100 text-rose-800 text-xs rounded-md">Drinks/Wine</span>}
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

        {loadingPeople ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-gray-600">No people recorded for this voyage.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crew Column */}
            {(() => {
              const crew = people.filter(p => p.is_crew === true);
              return (
                <div>
                  <button
                    onClick={() => setCrewCollapsed(!crewCollapsed)}
                    className="w-full text-sm font-semibold text-gray-700 mb-3 uppercase bg-blue-50 p-2 rounded hover:bg-blue-100 transition-colors flex items-center justify-between"
                  >
                    <span>Crew{crew.length > 0 && ` (${crew.length})`}</span>
                    <span className="text-lg transition-transform" style={{ transform: crewCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </button>
                  {!crewCollapsed && crew.length > 0 && (
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
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/reorder-passenger?voyage_slug=${encodeURIComponent(voyage.voyage_slug)}&person_slug=${encodeURIComponent(p.person_slug)}&direction=up`,
                                      { method: 'POST' }
                                    );
                                    if (response.ok) {
                                      const updatedPeople = await api.getVoyagePeople(voyage.voyage_slug);
                                      setPeople(updatedPeople);
                                    } else {
                                      const errorText = await response.text();
                                      console.error('Reorder failed:', response.status, errorText);
                                      alert(`Failed to reorder: ${response.status} ${errorText}`);
                                    }
                                  } catch (error) {
                                    console.error('Reorder up failed:', error);
                                    alert(`Error reordering: ${error}`);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Move up"
                              >
                                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/reorder-passenger?voyage_slug=${encodeURIComponent(voyage.voyage_slug)}&person_slug=${encodeURIComponent(p.person_slug)}&direction=down`,
                                      { method: 'POST' }
                                    );
                                    if (response.ok) {
                                      const updatedPeople = await api.getVoyagePeople(voyage.voyage_slug);
                                      setPeople(updatedPeople);
                                    } else {
                                      const errorText = await response.text();
                                      console.error('Reorder failed:', response.status, errorText);
                                      alert(`Failed to reorder: ${response.status} ${errorText}`);
                                    }
                                  } catch (error) {
                                    console.error('Reorder down failed:', error);
                                    alert(`Error reordering: ${error}`);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Move down"
                              >
                                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openEditPerson(p)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-blue-100 hover:bg-blue-200 transition-colors"
                                title="Edit person"
                              >
                                <svg className="w-3 h-3 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/unlink-from-voyage?person_slug=${encodeURIComponent(p.person_slug)}&voyage_slug=${encodeURIComponent(voyage.voyage_slug)}`,
                                      { method: 'DELETE' }
                                    );
                                    if (response.ok) {
                                      api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
                                    }
                                  } catch (error) {
                                    console.error('Remove failed:', error);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-red-100 hover:bg-red-200 transition-colors"
                                title="Remove from voyage"
                              >
                                <svg className="w-3 h-3 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  )}
                  {!crewCollapsed && crew.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No crew members</p>
                  )}
                </div>
              );
            })()}

            {/* Passengers & Guests Column */}
            {(() => {
              const passengers = people.filter(p => p.is_crew !== true);
              return (
                <div>
                  <button
                    onClick={() => setPassengersCollapsed(!passengersCollapsed)}
                    className="w-full text-sm font-semibold text-gray-700 mb-3 uppercase bg-gray-50 p-2 rounded hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <span>Passengers & Guests{passengers.length > 0 && ` (${passengers.length})`}</span>
                    <span className="text-lg transition-transform" style={{ transform: passengersCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </button>
                  {!passengersCollapsed && passengers.length > 0 && (
                  <ul className="space-y-2">
                    {passengers.map((p) => {
                      const bioLink = p.bio || p.wikipedia_url;
                      const roleToDisplay = p.capacity_role || p.role_title || p.title;
                      return (
                        <li key={p.person_slug} className="flex items-start gap-2 bg-gray-50 p-2 rounded">
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
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/reorder-passenger?voyage_slug=${encodeURIComponent(voyage.voyage_slug)}&person_slug=${encodeURIComponent(p.person_slug)}&direction=up`,
                                      { method: 'POST' }
                                    );
                                    if (response.ok) {
                                      const updatedPeople = await api.getVoyagePeople(voyage.voyage_slug);
                                      setPeople(updatedPeople);
                                    } else {
                                      const errorText = await response.text();
                                      console.error('Reorder failed:', response.status, errorText);
                                      alert(`Failed to reorder: ${response.status} ${errorText}`);
                                    }
                                  } catch (error) {
                                    console.error('Reorder up failed:', error);
                                    alert(`Error reordering: ${error}`);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Move up"
                              >
                                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/reorder-passenger?voyage_slug=${encodeURIComponent(voyage.voyage_slug)}&person_slug=${encodeURIComponent(p.person_slug)}&direction=down`,
                                      { method: 'POST' }
                                    );
                                    if (response.ok) {
                                      const updatedPeople = await api.getVoyagePeople(voyage.voyage_slug);
                                      setPeople(updatedPeople);
                                    } else {
                                      const errorText = await response.text();
                                      console.error('Reorder failed:', response.status, errorText);
                                      alert(`Failed to reorder: ${response.status} ${errorText}`);
                                    }
                                  } catch (error) {
                                    console.error('Reorder down failed:', error);
                                    alert(`Error reordering: ${error}`);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Move down"
                              >
                                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openEditPerson(p)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-blue-100 hover:bg-blue-200 transition-colors"
                                title="Edit person"
                              >
                                <svg className="w-3 h-3 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(
                                      `/api/curator/people/unlink-from-voyage?person_slug=${encodeURIComponent(p.person_slug)}&voyage_slug=${encodeURIComponent(voyage.voyage_slug)}`,
                                      { method: 'DELETE' }
                                    );
                                    if (response.ok) {
                                      api.getVoyagePeople(voyage.voyage_slug).then(setPeople);
                                    }
                                  } catch (error) {
                                    console.error('Remove failed:', error);
                                  }
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-red-100 hover:bg-red-200 transition-colors"
                                title="Remove from voyage"
                              >
                                <svg className="w-3 h-3 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  )}
                  {!passengersCollapsed && passengers.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No passengers</p>
                  )}
                </div>
              );
            })()}
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

              {/* Currently Attached Media */}
              {sourceMedia.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-600 mb-2">Attached Source Media ({sourceMedia.length}):</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {sourceMedia.map((media) => (
                      <div key={media.media_slug} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                          {media.public_derivative_url || media.s3_url || media.url ? (
                            <img
                              src={media.public_derivative_url || media.s3_url || media.url || ''}
                              alt={media.title || 'Source'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <div className="text-2xl">
                                {getMediaIcon(media.media_type)}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDetachMedia(media.media_slug, 'source')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-xs"
                          title="Remove from voyage"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
            <div className="space-y-2">
              {/* Text URLs */}
              {currentVoyage.source_urls && currentVoyage.source_urls.length > 0 && (
                <ul className="space-y-1">
                  {currentVoyage.source_urls.map((source, index) => {
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

              {/* Media Files */}
              {sourceMedia.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                  {sourceMedia.map((media) => {
                    const thumbnailUrl = media.public_derivative_url || media.s3_url || media.url || '';
                    const fullUrl = media.s3_url || media.url || '';

                    return (
                      <button
                        key={media.media_slug}
                        onClick={() => setLightboxSrc(fullUrl)}
                        className="group relative block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-green-500 transition-colors cursor-pointer"
                      >
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt={media.title || 'Source'}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <div className="text-center p-2">
                              <div className="text-3xl mb-1">
                                {getMediaIcon(media.media_type)}
                              </div>
                              <div className="text-xs text-gray-600 line-clamp-2">{media.title}</div>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="text-white text-xs line-clamp-2">
                            {[media.title, media.credit, media.date].filter(Boolean).join(' • ') || 'Source'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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

              {/* Currently Attached Media */}
              {additionalSourceMedia.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-600 mb-2">Attached Additional Source Media ({additionalSourceMedia.length}):</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {additionalSourceMedia.map((media) => (
                      <div key={media.media_slug} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                          {media.public_derivative_url || media.s3_url || media.url ? (
                            <img
                              src={media.public_derivative_url || media.s3_url || media.url || ''}
                              alt={media.title || 'Additional Source'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <div className="text-2xl">
                                {getMediaIcon(media.media_type)}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDetachMedia(media.media_slug, 'additional_source')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 text-xs"
                          title="Remove from voyage"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
            <div className="space-y-2">
              {/* Text URLs */}
              {currentVoyage.additional_sources && currentVoyage.additional_sources.trim() && (
                <div className="space-y-1">
                  {currentVoyage.additional_sources.split('\n').filter(s => s.trim()).map((source, index) => {
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

              {/* Media Files */}
              {additionalSourceMedia.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                  {additionalSourceMedia.map((media) => {
                    const thumbnailUrl = media.public_derivative_url || media.s3_url || media.url || '';
                    const fullUrl = media.s3_url || media.url || '';

                    return (
                      <button
                        key={media.media_slug}
                        onClick={() => setLightboxSrc(fullUrl)}
                        className="group relative block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-purple-500 transition-colors cursor-pointer"
                      >
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt={media.title || 'Additional Source'}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <div className="text-center p-2">
                              <div className="text-3xl mb-1">
                                {getMediaIcon(media.media_type)}
                              </div>
                              <div className="text-xs text-gray-600 line-clamp-2">{media.title}</div>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <div className="text-white text-xs line-clamp-2">
                            {[media.title, media.credit, media.date].filter(Boolean).join(' • ') || 'Additional Source'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Albums */}
      <div className="pt-4 border-t border-gray-200">
        <AlbumManager voyageSlug={voyage.voyage_slug} media={media} editMode={isEditing} />
      </div>

      {/* People */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">People ({people.length})</h4>

        {/* Person Search (Edit Mode Only) */}
        {isEditing && (
          <div className="mb-4 bg-blue-50 p-3 rounded">
            <label className="block text-xs font-medium text-gray-700 mb-1">Add People to Voyage</label>

            {!showCreatePersonForm ? (
              <>
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
                    onClick={() => setShowCreatePersonForm(true)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-xs whitespace-nowrap"
                  >
                    + Create New
                  </button>
                </div>
                {searching && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {searchResults.map(person => (
                      <div key={person.person_slug} className="p-2 bg-white border rounded text-xs">
                        <div className="font-medium">{person.full_name}</div>
                        {person.role_title && <div className="text-gray-600">{person.role_title}</div>}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => linkPerson(person.person_slug, true)}
                            className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs"
                          >
                            Add as Crew
                          </button>
                          <button
                            onClick={() => linkPerson(person.person_slug, false)}
                            className="bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 text-xs"
                          >
                            Add as Passenger
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3 bg-white p-3 rounded border border-gray-300">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={newPersonData.full_name}
                    onChange={(e) => setNewPersonData({ ...newPersonData, full_name: e.target.value })}
                    placeholder="e.g., John Smith"
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Role/Title</label>
                  <input
                    type="text"
                    value={newPersonData.role_title}
                    onChange={(e) => setNewPersonData({ ...newPersonData, role_title: e.target.value })}
                    placeholder="e.g., Secretary of State"
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bio/Wikipedia URL</label>
                  <input
                    type="text"
                    value={newPersonData.bio_url}
                    onChange={(e) => setNewPersonData({ ...newPersonData, bio_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="new-person-is-crew"
                    checked={newPersonData.is_crew}
                    onChange={(e) => setNewPersonData({ ...newPersonData, is_crew: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="new-person-is-crew" className="text-sm">Is Crew Member</label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createAndLinkNewPerson}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                  >
                    Create & Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCreatePersonForm(false);
                      setNewPersonData({ full_name: '', role_title: '', bio_url: '', is_crew: false });
                    }}
                    className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

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
                          onChange={(e) => setPersonFormData({ ...personFormData, is_crew: e.target.checked, capacity_role: e.target.checked ? personFormData.capacity_role : '' })}
                          className="mr-2 h-4 w-4"
                        />
                        <label htmlFor="is_crew" className="text-sm font-medium text-gray-700">
                          Is Crew Member <span className="text-gray-500 text-xs">(on this voyage)</span>
                        </label>
                      </div>

                      {/* Crew Role - only show if is_crew is checked */}
                      {personFormData.is_crew && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Crew Role <span className="text-gray-500 text-xs">(for this voyage only)</span>
                          </label>
                          <input
                            type="text"
                            value={personFormData.capacity_role}
                            onChange={(e) => setPersonFormData({ ...personFormData, capacity_role: e.target.value })}
                            placeholder="e.g., Captain, Steward, Cook"
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                          />
                        </div>
                      )}
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

      {/* Lightbox for viewing media */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-8 h-8 shadow hover:bg-gray-100 transition-colors z-10"
              aria-label="Close"
            >
              ✕
            </button>
            <a
              href={lightboxSrc}
              download
              className="absolute -top-3 -right-14 bg-blue-600 text-white rounded-md px-3 py-1.5 shadow hover:bg-blue-700 transition-colors text-sm font-medium z-10"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
            <img
              src={lightboxSrc}
              alt="Media"
              className="w-full max-h-[85vh] object-contain rounded-lg bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VoyageCardExpanded;
