import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Voyage, President } from "../types";
import { api } from "../api";
import Layout from "./Layout";

// Helper function to format date input with auto-separators
const formatDateInput = (value: string): string => {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');

  // Format as YYYY-MM-DD
  if (numbers.length <= 4) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  } else {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
  }
};

const VoyageEditor: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const isEditMode = Boolean(slug);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [presidents, setPresidents] = useState<President[]>([]);
  const [showNewPresidentModal, setShowNewPresidentModal] = useState(false);
  const [newPresidentData, setNewPresidentData] = useState({
    full_name: '',
    party: '',
    start_year: '',
    end_year: '',
    birth_year: '',
    death_year: '',
    wikipedia_url: '',
  });

  // Initialize with blank voyage
  const [voyage, setVoyage] = useState<Partial<Voyage>>({
    title: '',
    start_date: '',
    end_date: '',
    start_time: null,
    end_time: null,
    start_location: '',
    end_location: '',
    voyage_type: 'official',
    summary_markdown: '',
    notes_internal: '',
    additional_information: '',
    presidential_use: false,
    has_royalty: false,
    has_foreign_leader: false,
    mention_camp_david: false,
    mention_mount_vernon: false,
    mention_captain: false,
    mention_crew: false,
    mention_rmd: false,
    mention_yacht_spin: false,
    mention_menu: false,
    mention_drinks_wine: false,
    president_slug_from_voyage: '',
  });

  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [sourceMediaFiles, setSourceMediaFiles] = useState<Array<{file: File, date: string, credit: string, description: string}>>([]);
  const [uploadingSourceMedia, setUploadingSourceMedia] = useState(false);

  // Additional sources (separate from primary sources)
  const [additionalSourceUrls, setAdditionalSourceUrls] = useState<string[]>([]);
  const [newAdditionalSourceUrl, setNewAdditionalSourceUrl] = useState("");
  const [additionalSourceMediaFiles, setAdditionalSourceMediaFiles] = useState<Array<{file: File, date: string, credit: string, description: string}>>([]);

  // Existing media (loaded in edit mode)
  const [existingSourceMedia, setExistingSourceMedia] = useState<any[]>([]);
  const [existingAdditionalSourceMedia, setExistingAdditionalSourceMedia] = useState<any[]>([]);

  // Passenger management
  const [selectedPassengers, setSelectedPassengers] = useState<Array<{person_slug: string, full_name: string, role_title?: string, is_crew: boolean}>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [newPassengerData, setNewPassengerData] = useState({
    full_name: '',
    role_title: '',
    crew_role: '',
    wikipedia_url: '',
    is_crew: false
  });

  // Load presidents on mount
  useEffect(() => {
    api.listPresidents()
      .then(setPresidents)
      .catch(console.error);
  }, []);

  // Load existing voyage data if editing
  useEffect(() => {
    if (!isEditMode || !slug) return;

    const loadVoyageData = async () => {
      try {
        const [voyageData, peopleData, mediaData] = await Promise.all([
          api.getVoyage(slug),
          api.getVoyagePeople(slug),
          api.getVoyageMedia(slug)
        ]);

        // Set voyage data
        setVoyage(voyageData);

        // Set source URLs if they exist
        if (voyageData.source_urls && Array.isArray(voyageData.source_urls)) {
          setSourceUrls(voyageData.source_urls);
        }

        // Set additional sources if they exist
        if (voyageData.additional_sources) {
          const additionalUrls = voyageData.additional_sources.split('\n').filter((s: string) => s.trim());
          setAdditionalSourceUrls(additionalUrls);
        }

        // Set passengers
        const passengers = peopleData.map((p: any) => ({
          person_slug: p.person_slug,
          full_name: p.full_name,
          role_title: p.role_title || '',
          is_crew: p.is_crew || false
        }));
        setSelectedPassengers(passengers);

        // Filter and set existing media by category
        const sources = mediaData.filter((m: any) => m.media_category === 'source');
        const additionalSources = mediaData.filter((m: any) => m.media_category === 'additional_source');
        setExistingSourceMedia(sources);
        setExistingAdditionalSourceMedia(additionalSources);

      } catch (error) {
        console.error('Failed to load voyage data:', error);
        alert('Failed to load voyage data');
        navigate('/voyages');
      } finally {
        setLoading(false);
      }
    };

    loadVoyageData();
  }, [isEditMode, slug, navigate]);

  const updateField = (field: keyof Voyage, value: any) => {
    setVoyage(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateNewPresident = async () => {
    if (!newPresidentData.full_name.trim()) {
      alert('Please enter a full name');
      return;
    }

    if (!newPresidentData.start_year) {
      alert('Please enter the start year of presidency/ownership');
      return;
    }

    try {
      const response = await fetch('/api/curator/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: 'auto', // Auto-generate from name
          full_name: newPresidentData.full_name.trim(),
          role_title: 'President',
          organization: null,
          birth_year: newPresidentData.birth_year ? parseInt(newPresidentData.birth_year) : null,
          death_year: newPresidentData.death_year ? parseInt(newPresidentData.death_year) : null,
          wikipedia_url: newPresidentData.wikipedia_url.trim() || null,
          notes_internal: null,
          tags: null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create president/owner');
      }

      const newPerson = await response.json();

      // Create president/owner entry with term dates
      const term_start = newPresidentData.start_year ? `${newPresidentData.start_year}-01-01` : null;
      const term_end = newPresidentData.end_year ? `${newPresidentData.end_year}-12-31` : null;

      const presidentResponse = await fetch('/api/curator/presidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          president_slug: newPerson.person_slug,
          full_name: newPresidentData.full_name.trim(),
          party: newPresidentData.party.trim() || null,
          term_start: term_start,
          term_end: term_end,
          wikipedia_url: newPresidentData.wikipedia_url.trim() || null,
          tags: null
        })
      });

      if (!presidentResponse.ok) {
        const error = await presidentResponse.json();
        throw new Error(error.detail || 'Failed to create president/owner entry');
      }

      const newPresident = await presidentResponse.json();

      // Add to presidents list and select it
      setPresidents(prev => [...prev, newPresident]);
      updateField('president_slug_from_voyage', newPresident.president_slug);

      // Close modal and reset
      setShowNewPresidentModal(false);
      setNewPresidentData({
        full_name: '',
        party: '',
        start_year: '',
        end_year: '',
        birth_year: '',
        death_year: '',
        wikipedia_url: '',
      });

      alert(`President/Owner ${newPresidentData.full_name} created successfully!`);
    } catch (error) {
      console.error('Create president failed:', error);
      alert(`Failed to create president/owner: ${error}`);
    }
  };

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

  const handleSourceMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        date: '',
        credit: '',
        description: ''
      }));
      setSourceMediaFiles([...sourceMediaFiles, ...newFiles]);
      e.target.value = ''; // Reset input
    }
  };

  const removeSourceMediaFile = (index: number) => {
    setSourceMediaFiles(sourceMediaFiles.filter((_, i) => i !== index));
  };

  const updateSourceMediaMetadata = (index: number, field: 'date' | 'credit' | 'description', value: string) => {
    const updated = [...sourceMediaFiles];
    updated[index][field] = value;
    setSourceMediaFiles(updated);
  };

  // Additional source handlers
  const addAdditionalSourceUrl = () => {
    if (newAdditionalSourceUrl.trim()) {
      setAdditionalSourceUrls([...additionalSourceUrls, newAdditionalSourceUrl.trim()]);
      setNewAdditionalSourceUrl("");
    }
  };

  const removeAdditionalSourceUrl = (index: number) => {
    setAdditionalSourceUrls(additionalSourceUrls.filter((_, i) => i !== index));
  };

  const handleAdditionalSourceMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        date: '',
        credit: '',
        description: ''
      }));
      setAdditionalSourceMediaFiles([...additionalSourceMediaFiles, ...newFiles]);
      e.target.value = '';
    }
  };

  const removeAdditionalSourceMediaFile = (index: number) => {
    setAdditionalSourceMediaFiles(additionalSourceMediaFiles.filter((_, i) => i !== index));
  };

  const updateAdditionalSourceMediaMetadata = (index: number, field: 'date' | 'credit' | 'description', value: string) => {
    const updated = [...additionalSourceMediaFiles];
    updated[index][field] = value;
    setAdditionalSourceMediaFiles(updated);
  };

  // Passenger handlers
  const searchPeople = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const url = `/api/curator/people/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Error searching people:', error);
    }
  };

  const addExistingPassenger = (person: any) => {
    if (!selectedPassengers.find(p => p.person_slug === person.person_slug)) {
      setSelectedPassengers([...selectedPassengers, {
        person_slug: person.person_slug,
        full_name: person.full_name,
        role_title: person.role_title || '',
        is_crew: false
      }]);
    }
  };

  const createAndAddPassenger = async () => {
    if (!newPassengerData.full_name.trim()) {
      return;
    }

    try {
      // Use crew_role if is_crew is checked, otherwise use role_title
      const effectiveRole = newPassengerData.is_crew
        ? newPassengerData.crew_role.trim() || null
        : newPassengerData.role_title.trim() || null;

      const response = await fetch('/api/curator/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: 'auto',
          full_name: newPassengerData.full_name.trim(),
          role_title: effectiveRole,
          wikipedia_url: newPassengerData.wikipedia_url.trim() || null,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create person');
      }

      const newPerson = await response.json();

      // Add to selected passengers with is_crew flag
      setSelectedPassengers([...selectedPassengers, {
        person_slug: newPerson.person_slug,
        full_name: newPerson.full_name,
        role_title: effectiveRole || '',
        is_crew: newPassengerData.is_crew
      }]);

      setNewPassengerData({ full_name: '', role_title: '', crew_role: '', wikipedia_url: '', is_crew: false });
    } catch (error) {
      alert(`Failed to create person: ${error}`);
    }
  };

  const removePassenger = async (index: number) => {
    const passenger = selectedPassengers[index];

    // If in edit mode, call API to unlink passenger from voyage
    if (isEditMode && slug) {
      if (!confirm(`Remove ${passenger.full_name} from this voyage?`)) {
        return;
      }

      try {
        const response = await fetch(
          `/api/curator/people/unlink-from-voyage?person_slug=${encodeURIComponent(passenger.person_slug)}&voyage_slug=${encodeURIComponent(slug)}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          throw new Error('Failed to remove passenger');
        }

        const result = await response.json();
        if (result.person_deleted) {
          alert(`${passenger.full_name} removed from voyage and deleted (no other voyage associations)`);
        }
      } catch (error) {
        console.error('Error removing passenger:', error);
        alert('Failed to remove passenger from voyage');
        return;
      }
    }

    // Remove from local state
    setSelectedPassengers(selectedPassengers.filter((_, i) => i !== index));
  };

  const updatePassengerCrew = (index: number, isCrew: boolean) => {
    const updated = [...selectedPassengers];
    updated[index].is_crew = isCrew;
    setSelectedPassengers(updated);
  };

  const handleSave = async () => {
    // Validate required fields
    if (!voyage.start_date) {
      alert('Start date is required');
      return;
    }

    setSaving(true);
    try {
      // Use PUT for editing, POST for creating
      const url = isEditMode ? `/api/curator/voyages/${slug}` : '/api/curator/voyages/';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...voyage,
          source_urls: sourceUrls.length > 0 ? sourceUrls : null,
          additional_sources: additionalSourceUrls.length > 0 ? additionalSourceUrls.join('\n') : null,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const savedVoyage = await response.json();

      const voyageSlug = savedVoyage.voyage_slug;

      // Upload source media files if any
      if (sourceMediaFiles.length > 0) {
        setUploadingSourceMedia(true);
        for (const fileWithMetadata of sourceMediaFiles) {
          try {
            const formData = new FormData();
            formData.append('file', fileWithMetadata.file);
            formData.append('media_slug', 'auto');
            formData.append('voyage_slug', voyageSlug);
            formData.append('media_category', 'source');
            formData.append('title', fileWithMetadata.file.name);
            if (fileWithMetadata.date) formData.append('date', fileWithMetadata.date);
            if (fileWithMetadata.credit) formData.append('credit', fileWithMetadata.credit);
            if (fileWithMetadata.description) formData.append('description_markdown', fileWithMetadata.description);

            await fetch('/api/curator/media/upload', {
              method: 'POST',
              body: formData
            });
          } catch (err) {
            console.error(`Failed to upload source media ${fileWithMetadata.file.name}:`, err);
          }
        }
        setUploadingSourceMedia(false);
      }

      // Upload additional source media files if any
      if (additionalSourceMediaFiles.length > 0) {
        for (const fileWithMetadata of additionalSourceMediaFiles) {
          try {
            const formData = new FormData();
            formData.append('file', fileWithMetadata.file);
            formData.append('media_slug', 'auto');
            formData.append('voyage_slug', voyageSlug);
            formData.append('media_category', 'additional_source');
            formData.append('title', fileWithMetadata.file.name);
            if (fileWithMetadata.date) formData.append('date', fileWithMetadata.date);
            if (fileWithMetadata.credit) formData.append('credit', fileWithMetadata.credit);
            if (fileWithMetadata.description) formData.append('description_markdown', fileWithMetadata.description);

            await fetch('/api/curator/media/upload', {
              method: 'POST',
              body: formData
            });
          } catch (err) {
            console.error(`Failed to upload additional source media ${fileWithMetadata.file.name}:`, err);
          }
        }
      }

      // Link passengers if any (this will work for both create and edit)
      if (selectedPassengers.length > 0) {
        for (const passenger of selectedPassengers) {
          try {
            await fetch('/api/curator/people/link-to-voyage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                person_slug: passenger.person_slug,
                voyage_slug: voyageSlug,
                capacity_role: null,
                is_crew: passenger.is_crew || false
              })
            });
          } catch (err) {
            console.error(`Failed to link passenger ${passenger.full_name}:`, err);
          }
        }
      }

      // Navigate to the voyage list page
      navigate('/voyages');
    } catch (error) {
      console.error('Error creating voyage:', error);
      alert(`Failed to create voyage: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/voyages');
  };

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

  if (loading) {
    return (
      <Layout>
        <div className="p-4 max-w-5xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <p className="text-gray-600">Loading voyage data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 max-w-5xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditMode ? 'Edit Voyage' : 'Create New Voyage'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {isEditMode ? 'Update the voyage details below.' : 'Fill in the voyage details below. The voyage ID will be automatically generated.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || uploadingSourceMedia || !voyage.start_date}
              className={`px-4 py-2 rounded font-medium ${
                saving || uploadingSourceMedia || !voyage.start_date
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {uploadingSourceMedia ? 'Uploading source media...' : saving ? 'Saving...' : isEditMode ? 'Update Voyage' : 'Save Voyage'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded font-medium hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Voyage Title</label>
          <input
            type="text"
            value={voyage.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            placeholder="Enter a descriptive title for this voyage"
          />
        </div>

        {/* Voyage Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Voyage Type</label>
          <select
            value={voyage.voyage_type || ''}
            onChange={(e) => updateField('voyage_type', e.target.value || null)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">-- None --</option>
            <option value="official">Official</option>
            <option value="private">Private</option>
            <option value="maintenance">Maintenance</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* President/Owner */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">President/Owner</label>
          <div className="flex gap-2">
            <select
              value={voyage.president_slug_from_voyage || ''}
              onChange={(e) => updateField('president_slug_from_voyage', e.target.value || null)}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">-- Select President/Owner --</option>
              {presidents
                .filter((p) => !['reagan-ronald', 'bush-george-w', 'obama-barack', 'post-presidential'].includes(p.president_slug))
                .map((p) => (
                  <option key={p.president_slug} value={p.president_slug}>
                    {p.full_name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewPresidentModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium whitespace-nowrap"
            >
              + New President/Owner
            </button>
          </div>
        </div>

        {/* Date and Location Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-200">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={voyage.start_date || ''}
              onChange={(e) => {
                const formatted = formatDateInput(e.target.value);
                updateField('start_date', formatted || null);
              }}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
            <label className="block text-sm font-medium text-gray-700 mt-2">Start Time</label>
            <input
              type="time"
              value={voyage.start_time || ''}
              onChange={(e) => updateField('start_time', e.target.value || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="HH:MM"
            />
            <label className="block text-sm font-medium text-gray-700 mt-2">Start Location</label>
            <input
              type="text"
              value={voyage.start_location || ''}
              onChange={(e) => updateField('start_location', e.target.value || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Washington, DC"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="text"
              value={voyage.end_date || ''}
              onChange={(e) => {
                const formatted = formatDateInput(e.target.value);
                updateField('end_date', formatted || null);
              }}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
            <label className="block text-sm font-medium text-gray-700 mt-2">End Time</label>
            <input
              type="time"
              value={voyage.end_time || ''}
              onChange={(e) => updateField('end_time', e.target.value || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="HH:MM"
            />
            <label className="block text-sm font-medium text-gray-700 mt-2">End Location</label>
            <input
              type="text"
              value={voyage.end_location || ''}
              onChange={(e) => updateField('end_location', e.target.value || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Annapolis, MD"
            />
          </div>
        </div>

        {/* Boolean Attributes */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Voyage Attributes</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {booleanFields.map(field => (
              <div key={field.key} className="flex items-center">
                <input
                  type="checkbox"
                  id={field.key}
                  checked={voyage[field.key] === true}
                  onChange={(e) => updateField(field.key, e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor={field.key} className="text-sm text-gray-700">{field.label}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Information */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Information</label>
          <textarea
            value={voyage.additional_information || ''}
            onChange={(e) => updateField('additional_information', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            rows={4}
            placeholder="Additional notes and information about the voyage..."
          />
        </div>

        {/* Internal Notes */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
          <textarea
            value={voyage.notes_internal || ''}
            onChange={(e) => updateField('notes_internal', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            rows={2}
            placeholder="Internal notes (not shown publicly)..."
          />
        </div>

        {/* Sources */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Sources</h4>

          {/* Existing Source Media (in edit mode) */}
          {isEditMode && existingSourceMedia.length > 0 && (
            <div className="space-y-2 mb-4">
              <label className="text-xs font-medium text-gray-600">Existing Source Media:</label>
              {existingSourceMedia.map((media) => {
                const captionParts: string[] = [];
                if (media.date) captionParts.push(media.date);
                if (media.credit) captionParts.push(media.credit);
                if (media.description_markdown) captionParts.push(media.description_markdown);
                const caption = captionParts.join(' — ') || media.title || 'Source Media';

                return (
                  <div key={media.media_slug} className="flex items-center gap-2 bg-blue-50 p-2 rounded border border-blue-200">
                    <span className="flex-1 text-sm text-gray-700">📎 {caption}</span>
                    <a
                      href={media.url || media.s3_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* Text/URL Sources */}
          <div className="space-y-2 mb-4">
            <label className="text-xs font-medium text-gray-600">Text/URL Sources:</label>
            {sourceUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={url}
                  readOnly
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-sm"
                />
                <button
                  onClick={() => removeSourceUrl(index)}
                  className="text-red-600 hover:text-red-800 px-3 py-2 text-sm"
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
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <button
                onClick={addSourceUrl}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Add Text
              </button>
            </div>
          </div>

          {/* Media Sources */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Media Sources (PDFs, images, documents):</label>
            {sourceMediaFiles.map((fileWithMetadata, index) => (
              <div key={index} className="bg-blue-50 p-3 rounded border border-blue-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium text-gray-700">📎 {fileWithMetadata.file.name}</span>
                  <span className="text-xs text-gray-500">{(fileWithMetadata.file.size / 1024).toFixed(1)} KB</span>
                  <button
                    onClick={() => removeSourceMediaFile(index)}
                    className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    value={fileWithMetadata.date}
                    onChange={(e) => updateSourceMediaMetadata(index, 'date', e.target.value)}
                    placeholder="Date"
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                  <input
                    type="text"
                    value={fileWithMetadata.credit}
                    onChange={(e) => updateSourceMediaMetadata(index, 'credit', e.target.value)}
                    placeholder="Credit/Source"
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                  <input
                    type="text"
                    value={fileWithMetadata.description}
                    onChange={(e) => updateSourceMediaMetadata(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer text-sm">
                <span>+ Attach Media Source</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleSourceMediaFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">Upload PDFs, images, or documents as source materials</p>
            </div>
          </div>
        </div>

        {/* Additional Sources */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Sources</h4>

          {/* Existing Additional Source Media (in edit mode) */}
          {isEditMode && existingAdditionalSourceMedia.length > 0 && (
            <div className="space-y-2 mb-4">
              <label className="text-xs font-medium text-gray-600">Existing Additional Source Media:</label>
              {existingAdditionalSourceMedia.map((media) => {
                const captionParts: string[] = [];
                if (media.date) captionParts.push(media.date);
                if (media.credit) captionParts.push(media.credit);
                if (media.description_markdown) captionParts.push(media.description_markdown);
                const caption = captionParts.join(' — ') || media.title || 'Additional Source Media';

                return (
                  <div key={media.media_slug} className="flex items-center gap-2 bg-purple-50 p-2 rounded border border-purple-200">
                    <span className="flex-1 text-sm text-gray-700">📎 {caption}</span>
                    <a
                      href={media.url || media.s3_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-600 hover:underline"
                    >
                      View
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* Text/URL Additional Sources */}
          <div className="space-y-2 mb-4">
            <label className="text-xs font-medium text-gray-600">Text/URL Additional Sources:</label>
            {additionalSourceUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={url}
                  readOnly
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-sm"
                />
                <button
                  onClick={() => removeAdditionalSourceUrl(index)}
                  className="text-red-600 hover:text-red-800 px-3 py-2 text-sm"
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
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <button
                onClick={addAdditionalSourceUrl}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Add Text
              </button>
            </div>
          </div>

          {/* Media Additional Sources */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Media Additional Sources (PDFs, images, documents):</label>
            {additionalSourceMediaFiles.map((fileWithMetadata, index) => (
              <div key={index} className="bg-purple-50 p-3 rounded border border-purple-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium text-gray-700">📎 {fileWithMetadata.file.name}</span>
                  <span className="text-xs text-gray-500">{(fileWithMetadata.file.size / 1024).toFixed(1)} KB</span>
                  <button
                    onClick={() => removeAdditionalSourceMediaFile(index)}
                    className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    value={fileWithMetadata.date}
                    onChange={(e) => updateAdditionalSourceMediaMetadata(index, 'date', e.target.value)}
                    placeholder="Date"
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                  <input
                    type="text"
                    value={fileWithMetadata.credit}
                    onChange={(e) => updateAdditionalSourceMediaMetadata(index, 'credit', e.target.value)}
                    placeholder="Credit/Source"
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                  <input
                    type="text"
                    value={fileWithMetadata.description}
                    onChange={(e) => updateAdditionalSourceMediaMetadata(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 cursor-pointer text-sm">
                <span>+ Attach Additional Source Media</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleAdditionalSourceMediaFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">Upload PDFs, images, or documents as additional source materials</p>
            </div>
          </div>
        </div>

        {/* Passengers */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Passengers</h4>

          {/* Search/Add Interface */}
          <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="block text-xs font-medium text-gray-600 mb-2">Search and add passengers:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchPeople(e.target.value);
              }}
              placeholder="Type to search existing people or leave blank to see all..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2"
            />

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-y-auto bg-white">
                {searchResults.map((person) => (
                  <div
                    key={person.person_slug}
                    onClick={() => {
                      addExistingPassenger(person);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-sm">{person.full_name}</div>
                    {person.role_title && (
                      <div className="text-xs text-gray-500">{person.role_title}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Create New Person */}
            <div className="mt-3 pt-3 border-t border-gray-300">
              <label className="block text-xs font-medium text-gray-600 mb-2">Or create new person:</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newPassengerData.full_name}
                  onChange={(e) => setNewPassengerData({...newPassengerData, full_name: e.target.value})}
                  placeholder="Full Name *"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <input
                  type="text"
                  value={newPassengerData.role_title}
                  onChange={(e) => setNewPassengerData({...newPassengerData, role_title: e.target.value})}
                  placeholder="Role/Title (e.g., Secretary of State, Senator)"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="new-is-crew"
                    checked={newPassengerData.is_crew}
                    onChange={(e) => setNewPassengerData({...newPassengerData, is_crew: e.target.checked, crew_role: e.target.checked ? newPassengerData.crew_role : ''})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="new-is-crew" className="text-sm text-gray-700">Is Crew</label>
                </div>
                {newPassengerData.is_crew && (
                  <input
                    type="text"
                    value={newPassengerData.crew_role}
                    onChange={(e) => setNewPassengerData({...newPassengerData, crew_role: e.target.value})}
                    placeholder="Crew Role (e.g., Captain, Steward, Cook)"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                )}
                <input
                  type="url"
                  value={newPassengerData.wikipedia_url}
                  onChange={(e) => setNewPassengerData({...newPassengerData, wikipedia_url: e.target.value})}
                  placeholder="Wikipedia/Bio URL (optional)"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={createAndAddPassenger}
                disabled={!newPassengerData.full_name.trim()}
                className="mt-2 text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create & Add
              </button>
            </div>
          </div>

          {/* Selected Passengers List */}
          {selectedPassengers.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No passengers added yet</p>
          ) : (
            <div className="space-y-2">
              {selectedPassengers.map((passenger, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200 group hover:bg-gray-100">
                  <span className="flex-1 text-sm font-medium text-gray-700">
                    {passenger.full_name}
                    {passenger.role_title && <span className="text-gray-500 ml-2">({passenger.role_title})</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`crew-${index}`}
                      checked={passenger.is_crew}
                      onChange={(e) => updatePassengerCrew(index, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`crew-${index}`} className="text-xs text-gray-600">Crew</label>
                  </div>
                  <button
                    onClick={() => removePassenger(index)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full w-6 h-6 flex items-center justify-center text-lg font-bold transition-colors"
                    title="Remove passenger"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600">
          <p>
            <strong>Note:</strong> After creating the voyage, you can add more media and additional details
            from the voyage's detail page.
          </p>
        </div>
      </div>
    </div>

    {/* New President Modal */}
    {showNewPresidentModal && (
      <div className="fixed z-50 inset-0 overflow-y-auto" role="dialog" aria-modal="true">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          {/* Background overlay */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowNewPresidentModal(false)}></div>

          {/* Modal */}
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            {/* Header */}
            <div className="bg-white px-6 pt-5 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Create New President/Owner
                </h3>
                <button onClick={() => setShowNewPresidentModal(false)} className="text-gray-400 hover:text-gray-500">
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newPresidentData.full_name}
                    onChange={(e) => setNewPresidentData({ ...newPresidentData, full_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Franklin D. Roosevelt"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The system will automatically generate a unique ID from the name.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Political Party
                  </label>
                  <input
                    type="text"
                    value={newPresidentData.party}
                    onChange={(e) => setNewPresidentData({ ...newPresidentData, party: e.target.value })}
                    className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Democratic, Republican, Whig"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Year of Term <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={newPresidentData.start_year}
                      onChange={(e) => setNewPresidentData({ ...newPresidentData, start_year: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1933"
                      min="1600"
                      max="2100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Year of Term
                    </label>
                    <input
                      type="number"
                      value={newPresidentData.end_year}
                      onChange={(e) => setNewPresidentData({ ...newPresidentData, end_year: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1945"
                      min="1600"
                      max="2100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Birth Year
                    </label>
                    <input
                      type="number"
                      value={newPresidentData.birth_year}
                      onChange={(e) => setNewPresidentData({ ...newPresidentData, birth_year: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1882"
                      min="1600"
                      max="2100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Death Year
                    </label>
                    <input
                      type="number"
                      value={newPresidentData.death_year}
                      onChange={(e) => setNewPresidentData({ ...newPresidentData, death_year: e.target.value })}
                      className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 1945"
                      min="1600"
                      max="2100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wikipedia URL
                  </label>
                  <input
                    type="url"
                    value={newPresidentData.wikipedia_url}
                    onChange={(e) => setNewPresidentData({ ...newPresidentData, wikipedia_url: e.target.value })}
                    className="w-full border border-gray-300 rounded-md shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://en.wikipedia.org/wiki/..."
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-3 sm:flex sm:flex-row-reverse border-t border-gray-200">
              <button
                type="button"
                disabled={!newPresidentData.full_name.trim() || !newPresidentData.start_year}
                onClick={handleCreateNewPresident}
                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm ${
                  !newPresidentData.full_name.trim() || !newPresidentData.start_year
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                Create President/Owner
              </button>
              <button
                type="button"
                onClick={() => setShowNewPresidentModal(false)}
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

export default VoyageEditor;
