import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Voyage, President } from "../types";
import { api } from "../api";
import Layout from "./Layout";

const VoyageEditor: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [presidents, setPresidents] = useState<President[]>([]);
  const [showNewPresidentModal, setShowNewPresidentModal] = useState(false);
  const [newPresidentData, setNewPresidentData] = useState({
    full_name: '',
    start_year: '',
    end_year: '',
    birth_year: '',
    death_year: '',
    wikipedia_url: '',
  });

  // Initialize with blank voyage
  const [voyage, setVoyage] = useState<Partial<Voyage>>({
    title: '',
    start_date: new Date().toISOString().split('T')[0], // Default to today
    end_date: new Date().toISOString().split('T')[0],
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
  const [sourceMediaFiles, setSourceMediaFiles] = useState<File[]>([]);
  const [uploadingSourceMedia, setUploadingSourceMedia] = useState(false);

  // Passenger management
  const [selectedPassengers, setSelectedPassengers] = useState<Array<{person_slug: string, full_name: string, capacity_role: string}>>([]);
  const [showAddPassengerModal, setShowAddPassengerModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [newPassengerData, setNewPassengerData] = useState({
    full_name: '',
    role_title: '',
    capacity_role: ''
  });

  // Load presidents on mount
  useEffect(() => {
    api.listPresidents()
      .then(setPresidents)
      .catch(console.error);
  }, []);

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
      const presidentResponse = await fetch('/api/curator/presidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          president_slug: newPerson.person_slug,
          person_slug: newPerson.person_slug,
          start_year: parseInt(newPresidentData.start_year),
          end_year: newPresidentData.end_year ? parseInt(newPresidentData.end_year) : null,
        })
      });

      if (!presidentResponse.ok) {
        const error = await presidentResponse.json();
        throw new Error(error.detail || 'Failed to create president/owner entry');
      }

      const newPresident = await presidentResponse.json();

      // Add full person data to the president object for display
      const presidentWithPersonData = {
        ...newPresident,
        full_name: newPerson.full_name,
        birth_year: newPerson.birth_year,
        death_year: newPerson.death_year,
      };

      // Add to presidents list and select it
      setPresidents(prev => [...prev, presidentWithPersonData]);
      updateField('president_slug_from_voyage', newPresident.president_slug);

      // Close modal and reset
      setShowNewPresidentModal(false);
      setNewPresidentData({
        full_name: '',
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
      setSourceMediaFiles([...sourceMediaFiles, ...Array.from(e.target.files)]);
      e.target.value = ''; // Reset input
    }
  };

  const removeSourceMediaFile = (index: number) => {
    setSourceMediaFiles(sourceMediaFiles.filter((_, i) => i !== index));
  };

  // Passenger handlers
  const searchPeople = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`/api/people/search/autocomplete?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching people:', error);
    }
  };

  const addExistingPassenger = (person: any, role: string = '') => {
    if (!selectedPassengers.find(p => p.person_slug === person.person_slug)) {
      setSelectedPassengers([...selectedPassengers, {
        person_slug: person.person_slug,
        full_name: person.full_name,
        capacity_role: role
      }]);
    }
    setShowAddPassengerModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const createAndAddPassenger = async () => {
    if (!newPassengerData.full_name.trim()) {
      alert('Please enter a full name');
      return;
    }

    try {
      const response = await fetch('/api/curator/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_slug: 'auto',
          full_name: newPassengerData.full_name.trim(),
          role_title: newPassengerData.role_title.trim() || null,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create person');
      }

      const newPerson = await response.json();
      addExistingPassenger(newPerson, newPassengerData.capacity_role);
      setNewPassengerData({ full_name: '', role_title: '', capacity_role: '' });
    } catch (error) {
      alert(`Failed to create person: ${error}`);
    }
  };

  const removePassenger = (index: number) => {
    setSelectedPassengers(selectedPassengers.filter((_, i) => i !== index));
  };

  const updatePassengerRole = (index: number, role: string) => {
    const updated = [...selectedPassengers];
    updated[index].capacity_role = role;
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
      // voyage_slug will be auto-generated by backend from president + date
      const response = await fetch('/api/curator/voyages/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...voyage,
          source_urls: sourceUrls.length > 0 ? sourceUrls : null,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const createdVoyage = await response.json();

      // Upload source media files if any
      if (sourceMediaFiles.length > 0) {
        setUploadingSourceMedia(true);
        for (const file of sourceMediaFiles) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('media_slug', 'auto');
            formData.append('voyage_slug', createdVoyage.voyage_slug);
            formData.append('media_category', 'source');
            formData.append('title', file.name);

            await fetch('/api/curator/media/upload', {
              method: 'POST',
              body: formData
            });
          } catch (err) {
            console.error(`Failed to upload source media ${file.name}:`, err);
          }
        }
        setUploadingSourceMedia(false);
      }

      // Link passengers if any
      if (selectedPassengers.length > 0) {
        for (const passenger of selectedPassengers) {
          try {
            await fetch('/api/curator/people/link-to-voyage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                person_slug: passenger.person_slug,
                voyage_slug: createdVoyage.voyage_slug,
                capacity_role: passenger.capacity_role || null,
                is_crew: false
              })
            });
          } catch (err) {
            console.error(`Failed to link passenger ${passenger.full_name}:`, err);
          }
        }
      }

      // Navigate to the newly created voyage
      navigate(`/voyages/${createdVoyage.voyage_slug}`);
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

  return (
    <Layout>
      <div className="p-4 max-w-5xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Create New Voyage</h1>
            <p className="text-sm text-gray-600 mt-1">Fill in the voyage details below. The voyage ID will be automatically generated.</p>
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
              {uploadingSourceMedia ? 'Uploading source media...' : saving ? 'Saving...' : 'Save Voyage'}
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
              type="date"
              value={voyage.start_date || ''}
              onChange={(e) => updateField('start_date', e.target.value || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
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
              type="date"
              value={voyage.end_date || ''}
              onChange={(e) => updateField('end_date', e.target.value || null)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
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

        {/* Summary */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
          <textarea
            value={voyage.summary_markdown || ''}
            onChange={(e) => updateField('summary_markdown', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            rows={4}
            placeholder="Brief summary of the voyage..."
          />
        </div>

        {/* Additional Information */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Information</label>
          <textarea
            value={voyage.additional_information || ''}
            onChange={(e) => updateField('additional_information', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            rows={3}
            placeholder="Additional context or details..."
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
            {sourceMediaFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-blue-50 p-2 rounded">
                <span className="flex-1 text-sm text-gray-700">📎 {file.name}</span>
                <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => removeSourceMediaFile(index)}
                  className="text-red-600 hover:text-red-800 px-2 py-1 text-sm"
                >
                  Remove
                </button>
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

        {/* Passengers */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Passengers</h4>
            <button
              onClick={() => setShowAddPassengerModal(true)}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              + Add Passenger
            </button>
          </div>

          {selectedPassengers.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No passengers added yet</p>
          ) : (
            <div className="space-y-2">
              {selectedPassengers.map((passenger, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                  <span className="flex-1 text-sm font-medium text-gray-700">{passenger.full_name}</span>
                  <input
                    type="text"
                    value={passenger.capacity_role}
                    onChange={(e) => updatePassengerRole(index, e.target.value)}
                    placeholder="Role (e.g., Guest, Admiral)"
                    className="w-48 border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => removePassenger(index)}
                    className="text-red-600 hover:text-red-800 px-2 text-sm"
                  >
                    Remove
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

    {/* Add Passenger Modal */}
    {showAddPassengerModal && (
      <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add Passenger</h3>

              {/* Search existing people */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Existing People</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchPeople(e.target.value);
                  }}
                  placeholder="Type name to search..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                    {searchResults.map((person) => (
                      <div
                        key={person.person_slug}
                        onClick={() => addExistingPassenger(person)}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-sm">{person.full_name}</div>
                        {person.role_title && (
                          <div className="text-xs text-gray-500">{person.role_title}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Or Create New Person</p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={newPassengerData.full_name}
                      onChange={(e) => setNewPassengerData({...newPassengerData, full_name: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">General Role/Title</label>
                    <input
                      type="text"
                      value={newPassengerData.role_title}
                      onChange={(e) => setNewPassengerData({...newPassengerData, role_title: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="e.g., Senator, General, Diplomat"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Role on This Voyage</label>
                    <input
                      type="text"
                      value={newPassengerData.capacity_role}
                      onChange={(e) => setNewPassengerData({...newPassengerData, capacity_role: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="e.g., Guest, Advisor, Crew"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={createAndAddPassenger}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Create & Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddPassengerModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setNewPassengerData({ full_name: '', role_title: '', capacity_role: '' });
                }}
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
