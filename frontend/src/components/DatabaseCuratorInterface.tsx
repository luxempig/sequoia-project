import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import { Voyage } from "../types";

interface VoyageListItem {
  voyage_slug: string;
  title?: string;
  start_date?: string;
  president_slug_from_voyage?: string;
}

const DatabaseCuratorInterface: React.FC = () => {
  const [voyages, setVoyages] = useState<VoyageListItem[]>([]);
  const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null);
  const [editMode, setEditMode] = useState<'view' | 'edit' | 'add'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      loadVoyages();
    }
  }, [isAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin") {
      setIsAuthenticated(true);
      setPassword("");
    } else {
      setError("Invalid password");
      setPassword("");
    }
  };

  const loadVoyages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/voyages?limit=500');
      if (!response.ok) {
        throw new Error('Failed to load voyages');
      }
      const data = await response.json();
      setVoyages(data);
    } catch (error) {
      console.error('Failed to load voyages:', error);
      setError(`Failed to load voyages: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadVoyageDetails = async (slug: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/voyages/${slug}`);
      if (!response.ok) {
        throw new Error('Failed to load voyage details');
      }
      const data = await response.json();
      setSelectedVoyage(data);
      setEditMode('view');
    } catch (error) {
      console.error('Failed to load voyage details:', error);
      setError(`Failed to load details: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const createNewVoyage = (): Voyage => {
    const year = new Date().getFullYear();
    const slug = `new-voyage-${Date.now()}`;

    return {
      voyage_slug: slug,
      title: '',
      start_date: null,
      end_date: null,
      origin: null,
      destination: null,
      voyage_type: 'official',
      has_photo: false,
      has_video: false,
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
    };
  };

  const saveVoyage = async (voyage: Voyage) => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const isNew = editMode === 'add';
      const url = isNew
        ? '/api/curator/voyages'
        : `/api/curator/voyages/${voyage.voyage_slug}`;

      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(voyage)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save voyage');
      }

      const savedVoyage = await response.json();
      setSuccess(`Voyage ${isNew ? 'created' : 'updated'} successfully!`);

      // Reload voyages list
      await loadVoyages();

      // Update selected voyage
      setSelectedVoyage(savedVoyage);
      setEditMode('view');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error('Save failed:', error);
      setError(`Failed to save: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteVoyage = async (slug: string) => {
    if (!confirm(`Are you sure you want to delete voyage "${slug}"? This cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/curator/voyages/${slug}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete voyage');
      }

      setSuccess('Voyage deleted successfully!');
      setSelectedVoyage(null);
      await loadVoyages();

      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error('Delete failed:', error);
      setError(`Failed to delete: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  const duplicateVoyage = async (slug: string) => {
    const newSlug = prompt(`Enter slug for duplicated voyage:`, `${slug}-copy`);
    if (!newSlug) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/curator/voyages/${slug}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ new_slug: newSlug })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to duplicate voyage');
      }

      setSuccess('Voyage duplicated successfully!');
      await loadVoyages();

      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error('Duplicate failed:', error);
      setError(`Failed to duplicate: ${error instanceof Error ? error.message : error}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Curator Access</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                  required
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                Access Curator Interface
              </button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-blue-800 mb-2">
                  Voyage Database Editor
                </h1>
                <p className="text-gray-600">
                  Direct database manipulation • {voyages.length} voyages
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedVoyage(createNewVoyage());
                  setEditMode('add');
                }}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                + Create New Voyage
              </button>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {editMode === 'view' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Voyage List */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">All Voyages</h2>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {loading && voyages.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                    ) : voyages.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No voyages found</p>
                    ) : (
                      voyages.map((voyage) => (
                        <div
                          key={voyage.voyage_slug}
                          onClick={() => loadVoyageDetails(voyage.voyage_slug)}
                          className={`p-3 border rounded cursor-pointer transition-colors ${
                            selectedVoyage?.voyage_slug === voyage.voyage_slug
                              ? 'bg-blue-50 border-blue-300'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <h3 className="font-medium text-blue-600 text-sm truncate">
                            {voyage.title || voyage.voyage_slug}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {voyage.start_date || 'No date'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Voyage Details */}
              <div className="lg:col-span-2">
                {selectedVoyage ? (
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-gray-800">Voyage Details</h2>
                      <div className="space-x-2">
                        <button
                          onClick={() => setEditMode('edit')}
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => duplicateVoyage(selectedVoyage.voyage_slug)}
                          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => deleteVoyage(selectedVoyage.voyage_slug)}
                          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Slug</label>
                        <p className="text-gray-900">{selectedVoyage.voyage_slug}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Title</label>
                        <p className="text-gray-900">{selectedVoyage.title || '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Start Date</label>
                          <p className="text-gray-900">{selectedVoyage.start_date || '—'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">End Date</label>
                          <p className="text-gray-900">{selectedVoyage.end_date || '—'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Origin</label>
                          <p className="text-gray-900">{selectedVoyage.origin || selectedVoyage.start_location || '—'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">Destination</label>
                          <p className="text-gray-900">{selectedVoyage.destination || selectedVoyage.end_location || '—'}</p>
                        </div>
                      </div>
                      {selectedVoyage.summary_markdown && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">Summary</label>
                          <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                            {selectedVoyage.summary_markdown}
                          </p>
                        </div>
                      )}

                      {/* Boolean Flags */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Metadata</label>
                        <div className="flex flex-wrap gap-2">
                          {selectedVoyage.has_photo && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Has Photo</span>}
                          {selectedVoyage.has_video && <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Has Video</span>}
                          {selectedVoyage.presidential_use && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Presidential Use</span>}
                          {selectedVoyage.has_royalty && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Royalty</span>}
                          {selectedVoyage.has_foreign_leader && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">Foreign Leader</span>}
                          {selectedVoyage.mention_camp_david && <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded">Camp David</span>}
                          {selectedVoyage.mention_yacht_spin && <span className="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded">Yacht Spin</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-lg p-6 flex items-center justify-center h-64">
                    <p className="text-gray-500">Select a voyage to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(editMode === 'edit' || editMode === 'add') && selectedVoyage && (
            <VoyageEditorForm
              voyage={selectedVoyage}
              onSave={saveVoyage}
              onCancel={() => {
                setEditMode('view');
                if (editMode === 'add') {
                  setSelectedVoyage(null);
                }
              }}
              isNew={editMode === 'add'}
              loading={loading}
            />
          )}
        </div>
      </div>
    </Layout>
  );
};

interface VoyageEditorFormProps {
  voyage: Voyage;
  onSave: (voyage: Voyage) => void;
  onCancel: () => void;
  isNew: boolean;
  loading: boolean;
}

const VoyageEditorForm: React.FC<VoyageEditorFormProps> = ({
  voyage: initialVoyage,
  onSave,
  onCancel,
  isNew,
  loading
}) => {
  const [voyage, setVoyage] = useState<Voyage>(initialVoyage);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {isNew ? 'Create New Voyage' : `Edit: ${voyage.voyage_slug}`}
        </h2>
        <div className="space-x-2">
          <button
            onClick={() => onSave(voyage)}
            disabled={loading}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voyage Slug *
            </label>
            <input
              type="text"
              value={voyage.voyage_slug}
              onChange={(e) => setVoyage({ ...voyage, voyage_slug: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., truman-1945-01"
              disabled={!isNew}
            />
            <p className="text-xs text-gray-500 mt-1">Unique identifier (cannot be changed after creation)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={voyage.title || ''}
              onChange={(e) => setVoyage({ ...voyage, title: e.target.value || null })}
              className="w-full border rounded px-3 py-2"
              placeholder="Brief title for this voyage"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={voyage.start_date || ''}
                onChange={(e) => setVoyage({ ...voyage, start_date: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={voyage.end_date || ''}
                onChange={(e) => setVoyage({ ...voyage, end_date: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Origin
              </label>
              <input
                type="text"
                value={voyage.origin || voyage.start_location || ''}
                onChange={(e) => setVoyage({ ...voyage, origin: e.target.value || null, start_location: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination
              </label>
              <input
                type="text"
                value={voyage.destination || voyage.end_location || ''}
                onChange={(e) => setVoyage({ ...voyage, destination: e.target.value || null, end_location: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voyage Type
            </label>
            <select
              value={voyage.voyage_type || 'official'}
              onChange={(e) => setVoyage({ ...voyage, voyage_type: e.target.value as any })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="official">Official</option>
              <option value="private">Private</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vessel Name
            </label>
            <input
              type="text"
              value={voyage.vessel_name || ''}
              onChange={(e) => setVoyage({ ...voyage, vessel_name: e.target.value || null })}
              className="w-full border rounded px-3 py-2"
              placeholder="USS Sequoia"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              President Slug
            </label>
            <input
              type="text"
              value={voyage.president_slug_from_voyage || ''}
              onChange={(e) => setVoyage({ ...voyage, president_slug_from_voyage: e.target.value || null })}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., truman-harry-s"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary
            </label>
            <textarea
              value={voyage.summary_markdown || ''}
              onChange={(e) => setVoyage({ ...voyage, summary_markdown: e.target.value || null })}
              rows={4}
              className="w-full border rounded px-3 py-2"
              placeholder="Brief description of the voyage..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Internal Notes
            </label>
            <textarea
              value={voyage.notes_internal || ''}
              onChange={(e) => setVoyage({ ...voyage, notes_internal: e.target.value || null })}
              rows={3}
              className="w-full border rounded px-3 py-2"
              placeholder="Curator notes (not public)..."
            />
          </div>
        </div>

        {/* Right Column - Boolean Metadata */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Voyage Metadata</h3>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.has_photo || false}
                  onChange={(e) => setVoyage({ ...voyage, has_photo: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Has Photos</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.has_video || false}
                  onChange={(e) => setVoyage({ ...voyage, has_video: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Has Video</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.presidential_use || false}
                  onChange={(e) => setVoyage({ ...voyage, presidential_use: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Presidential Use</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.has_royalty || false}
                  onChange={(e) => setVoyage({ ...voyage, has_royalty: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Royalty Present</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.has_foreign_leader || false}
                  onChange={(e) => setVoyage({ ...voyage, has_foreign_leader: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Foreign Leader</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_camp_david || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_camp_david: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Camp David</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_mount_vernon || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_mount_vernon: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Mount Vernon</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_captain || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_captain: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Captain</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_crew || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_crew: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Crew</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_rmd || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_rmd: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">RMD</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_yacht_spin || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_yacht_spin: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Yacht Spin</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_menu || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_menu: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Menu Info</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voyage.mention_drinks_wine || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_drinks_wine: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Drinks/Wine</span>
              </label>
            </div>

            {/* Conditional text fields */}
            <div className="mt-4 space-y-3">
              {voyage.presidential_use && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Presidential Initials
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., HST, FDR"
                    value={voyage.presidential_initials || ''}
                    onChange={(e) => setVoyage({ ...voyage, presidential_initials: e.target.value || null })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              )}

              {voyage.has_royalty && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Royalty Details
                  </label>
                  <input
                    type="text"
                    placeholder="Names and titles"
                    value={voyage.royalty_details || ''}
                    onChange={(e) => setVoyage({ ...voyage, royalty_details: e.target.value || null })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              )}

              {voyage.has_foreign_leader && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Foreign Leader Country
                  </label>
                  <input
                    type="text"
                    placeholder="Country name"
                    value={voyage.foreign_leader_country || ''}
                    onChange={(e) => setVoyage({ ...voyage, foreign_leader_country: e.target.value || null })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Next Steps</h3>
            <p className="text-xs text-gray-600">
              After saving this voyage, you can:
            </p>
            <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc list-inside">
              <li>Link people as passengers</li>
              <li>Upload and attach media</li>
              <li>Add source URLs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseCuratorInterface;
