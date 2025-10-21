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

      // Create president entry with term dates
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
        throw new Error('Failed to create president/owner entry');
      }

      const newPresident = await presidentResponse.json();

      // Add to presidents list and select it
      setPresidents(prev => [...prev, {
        ...newPresident,
        full_name: newPresidentData.full_name,
        birth_year: newPresidentData.birth_year ? parseInt(newPresidentData.birth_year) : null,
        death_year: newPresidentData.death_year ? parseInt(newPresidentData.death_year) : null,
      }]);
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
              disabled={saving || !voyage.start_date}
              className={`px-4 py-2 rounded font-medium ${
                saving || !voyage.start_date
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Voyage'}
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
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Sources</h4>
          <div className="space-y-2">
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
                  className="text-red-600 hover:text-red-800 px-3 py-2"
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
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
              />
              <button
                onClick={addSourceUrl}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-sm text-gray-600">
          <p>
            <strong>Note:</strong> After creating the voyage, you can add media, people, and additional details
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
    </Layout>
  );
};

export default VoyageEditor;
