import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import { Voyage, Person, MediaItem } from "../types";

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

  // Linked entities
  const [linkedPeople, setLinkedPeople] = useState<Person[]>([]);
  const [linkedMedia, setLinkedMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      loadVoyages();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedVoyage && editMode === 'view') {
      loadLinkedEntities(selectedVoyage.voyage_slug);
    }
  }, [selectedVoyage, editMode]);

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

  const loadLinkedEntities = async (slug: string) => {
    try {
      // Load people
      const peopleResp = await fetch(`/api/voyages/${slug}/people`);
      if (peopleResp.ok) {
        const people = await peopleResp.json();
        setLinkedPeople(people);
      }

      // Load media
      const mediaResp = await fetch(`/api/media/by-voyage?voyage_slug=${slug}`);
      if (mediaResp.ok) {
        const media = await mediaResp.json();
        setLinkedMedia(media);
      }
    } catch (error) {
      console.error('Failed to load linked entities:', error);
    }
  };

  const createNewVoyage = (): Voyage => {
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

      await loadVoyages();
      setSelectedVoyage(savedVoyage);
      setEditMode('view');

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
                  <div className="space-y-6">
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
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Linked People Panel */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Passengers ({linkedPeople.length})</h3>
                      {linkedPeople.length === 0 ? (
                        <p className="text-gray-500 text-sm">No people linked to this voyage</p>
                      ) : (
                        <div className="space-y-2">
                          {linkedPeople.map((person) => (
                            <div key={person.person_slug} className="border rounded p-3">
                              <p className="font-medium text-sm">{person.full_name}</p>
                              {person.capacity_role && (
                                <p className="text-xs text-gray-600">{person.capacity_role}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Linked Media Panel */}
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Media ({linkedMedia.length})</h3>
                      {linkedMedia.length === 0 ? (
                        <p className="text-gray-500 text-sm">No media linked to this voyage</p>
                      ) : (
                        <div className="space-y-2">
                          {linkedMedia.map((media) => (
                            <div key={media.media_slug} className="border rounded p-3">
                              <p className="font-medium text-sm">{media.title || media.media_slug}</p>
                              <p className="text-xs text-gray-600">{media.media_type || 'unknown type'}</p>
                            </div>
                          ))}
                        </div>
                      )}
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
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState("");

  // Media upload state
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaCredit, setMediaCredit] = useState("");

  // Person search state
  const [personSearch, setPersonSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Parse source_urls if it exists (it might be undefined or a string in some cases)
    if (Array.isArray(voyage.source_urls)) {
      setSourceUrls(voyage.source_urls);
    } else if (typeof voyage.source_urls === 'string') {
      setSourceUrls([voyage.source_urls]);
    }
  }, []);

  const addSourceUrl = () => {
    if (newSourceUrl.trim()) {
      const updated = [...sourceUrls, newSourceUrl.trim()];
      setSourceUrls(updated);
      setVoyage({ ...voyage, source_urls: updated as any });
      setNewSourceUrl("");
    }
  };

  const removeSourceUrl = (index: number) => {
    const updated = sourceUrls.filter((_, i) => i !== index);
    setSourceUrls(updated);
    setVoyage({ ...voyage, source_urls: updated as any });
  };

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
      }
    } catch (error) {
      console.error('Link failed:', error);
      alert('Failed to link person');
    }
  };

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

      const response = await fetch('/api/curator/media/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        alert('Media uploaded successfully!');
        setSelectedFile(null);
        setMediaTitle("");
        setMediaCredit("");
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {isNew ? 'Create New Voyage' : `Edit: ${voyage.voyage_slug}`}
        </h2>
        <div className="space-x-2">
          <button
            onClick={() => onSave({ ...voyage, source_urls: sourceUrls as any })}
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
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={voyage.start_date || ''}
                onChange={(e) => setVoyage({ ...voyage, start_date: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={voyage.end_date || ''}
                onChange={(e) => setVoyage({ ...voyage, end_date: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
            <textarea
              value={voyage.summary_markdown || ''}
              onChange={(e) => {
                // Strip markdown symbols automatically
                const cleanText = e.target.value
                  .replace(/^#+\s*/gm, '')  // Remove heading markers (##, ###, etc)
                  .replace(/\*\*/g, '')      // Remove bold markers
                  .replace(/\*/g, '')        // Remove italic markers
                  .replace(/^[-*+]\s/gm, '') // Remove list markers
                  .replace(/^\d+\.\s/gm, '') // Remove numbered list markers
                  .replace(/`/g, '');        // Remove code markers
                setVoyage({ ...voyage, summary_markdown: cleanText || null });
              }}
              rows={4}
              className="w-full border rounded px-3 py-2"
              placeholder="Enter plain text description..."
            />
          </div>

          {/* Source URLs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source URLs</label>
            <div className="space-y-2">
              {sourceUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={url}
                    readOnly
                    className="flex-1 border rounded px-3 py-2 bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => removeSourceUrl(index)}
                    className="text-red-600 hover:text-red-800 text-sm px-2"
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
                  className="flex-1 border rounded px-3 py-2 text-sm"
                />
                <button
                  onClick={addSourceUrl}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Boolean Metadata - Checkboxes */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-800 mb-3">Metadata Flags</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'has_photo', label: 'Has Photo' },
                { key: 'has_video', label: 'Has Video' },
                { key: 'presidential_use', label: 'Presidential Use' },
                { key: 'has_royalty', label: 'Royalty' },
                { key: 'has_foreign_leader', label: 'Foreign Leader' },
                { key: 'mention_camp_david', label: 'Camp David' },
                { key: 'mention_mount_vernon', label: 'Mount Vernon' },
                { key: 'mention_captain', label: 'Captain' },
                { key: 'mention_crew', label: 'Crew' },
                { key: 'mention_rmd', label: 'RMD' },
                { key: 'mention_yacht_spin', label: 'Yacht Spin' },
                { key: 'mention_menu', label: 'Menu' },
                { key: 'mention_drinks_wine', label: 'Drinks/Wine' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(voyage[key as keyof Voyage])}
                    onChange={(e) => setVoyage({ ...voyage, [key]: e.target.checked })}
                    className="rounded"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Person Search & Media Upload */}
        <div className="space-y-4">
          {/* Person Search */}
          {!isNew && (
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="text-sm font-medium text-gray-800 mb-2">Link People</h3>
              <input
                type="text"
                value={personSearch}
                onChange={(e) => {
                  setPersonSearch(e.target.value);
                  searchPeople(e.target.value);
                }}
                placeholder="Search for people..."
                className="w-full border rounded px-3 py-2 text-sm mb-2"
              />
              {searching && <p className="text-xs text-gray-600">Searching...</p>}
              {searchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {searchResults.map((person) => (
                    <div
                      key={person.person_slug}
                      onClick={() => linkPerson(person.person_slug, person.full_name)}
                      className="p-2 bg-white rounded hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      <p className="font-medium">{person.full_name}</p>
                      {person.role && <p className="text-xs text-gray-600">{person.role}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Media Upload */}
          {!isNew && (
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="text-sm font-medium text-gray-800 mb-2">Upload Media</h3>
              <input
                type="file"
                accept="image/*,video/*,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full border rounded px-3 py-2 text-sm mb-2"
              />
              {selectedFile && (
                <>
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Title (optional)"
                    className="w-full border rounded px-3 py-2 text-sm mb-2"
                  />
                  <input
                    type="text"
                    value={mediaCredit}
                    onChange={(e) => setMediaCredit(e.target.value)}
                    placeholder="Credit/Source"
                    className="w-full border rounded px-3 py-2 text-sm mb-2"
                  />
                  <button
                    onClick={uploadMedia}
                    disabled={uploadingMedia}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {uploadingMedia ? 'Uploading...' : 'Upload to S3'}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="border rounded-lg p-4 bg-yellow-50">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Tips</h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Save the voyage first before linking people or media</li>
              <li>Use descriptive slugs (e.g., truman-1945-01)</li>
              <li>Source URLs support multiple entries</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseCuratorInterface;
