import React, { useState, useEffect } from "react";
import Layout from "./Layout";

interface Passenger {
  name: string;
  full_name: string;
  title?: string | null;
  role: string;
  bio: string;
}

interface MediaItem {
  media_name: string;
  link: string;
  source: string;
  date: string;
  type: string;
  link_type: string;
  file?: File | null; // Temporary for upload functionality
  s3_path?: string; // Temporary for upload functionality
}

interface Voyage {
  voyage: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  origin: string | null;
  destination: string | null;
  passengers: Passenger[];
  media: MediaItem[];
  notes: string[];
  tags: string[];
  missing_info: string[];
}

interface PresidentData {
  term_start: string;
  term_end: string;
  info: string;
  voyages: Voyage[];
}

interface TrumanData {
  "truman-harry-s": PresidentData;
}

const JsonCuratorInterface: React.FC = () => {
  const [rawData, setRawData] = useState<TrumanData | null>(null);
  const [data, setData] = useState<PresidentData | null>(null);
  const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null);
  const [editMode, setEditMode] = useState<'view' | 'edit' | 'add'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      loadPresidentData();
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

  const loadPresidentData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/truman.json');
      if (!response.ok) {
        throw new Error('Failed to load president data');
      }
      const jsonData = await response.json();
      setRawData(jsonData);
      
      // Extract Truman data and add president metadata
      const trumanData = jsonData["truman-harry-s"];
      if (trumanData) {
        setData({
          ...trumanData,
          president: {
            full_name: "Harry S. Truman",
            party: "Democratic Party",
            slug: "truman-harry-s",
            term_start: trumanData.term_start,
            term_end: trumanData.term_end
          }
        });
      }
    } catch (error) {
      console.error('Failed to load president data:', error);
      setError(`Failed to load data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const formatVoyagePreview = (voyage: Voyage): string => {
    const dateRange = voyage.start_date && voyage.end_date 
      ? `${voyage.start_date} to ${voyage.end_date}`
      : voyage.start_date 
        ? `From ${voyage.start_date}`
        : voyage.end_date 
          ? `Until ${voyage.end_date}`
          : "Date unknown";
    
    const route = voyage.origin && voyage.destination 
      ? `${voyage.origin} → ${voyage.destination}`
      : voyage.origin 
        ? `From ${voyage.origin}`
        : voyage.destination 
          ? `To ${voyage.destination}`
          : null;
    
    const passengers = voyage.passengers?.length
      ? voyage.passengers.map(p => p.full_name).join(", ")
      : "No passengers recorded";

    return `**Date:** ${dateRange}
**Route:** ${route || "Route unknown"}
**Passengers:** ${passengers}
${voyage.notes?.length ? `\n**Notes:** ${voyage.notes.join("; ")}` : ""}
${voyage.tags?.length ? `\n**Tags:** ${voyage.tags.join(", ")}` : ""}
${voyage.missing_info?.length ? `\n**Missing Information:** ${voyage.missing_info.join(", ")}` : ""}`;
  };

  const createNewVoyage = (): Voyage => {
    const voyageCount = data?.voyages.length || 0;
    const year = new Date().getFullYear();
    
    return {
      voyage: `truman-harry-s-${year}-new-${voyageCount + 1}`,
      start_date: null,
      end_date: null,
      start_time: null,
      end_time: null,
      origin: null,
      destination: null,
      passengers: [],
      media: [],
      notes: [],
      tags: [],
      missing_info: []
    };
  };

  const saveVoyage = async (updatedVoyage: Voyage) => {
    if (!data) return;

    try {
      // First upload any media files
      const voyageWithUploadedMedia = await uploadMediaFiles(updatedVoyage);

      let updatedVoyages;
      if (editMode === 'add') {
        updatedVoyages = [...data.voyages, voyageWithUploadedMedia];
      } else {
        updatedVoyages = data.voyages.map((v: Voyage) => 
          v.voyage === selectedVoyage?.voyage ? voyageWithUploadedMedia : v
        );
      }

      const updatedData = {
        ...data,
        voyages: updatedVoyages
      };

      // Save the updated JSON data back to the system
      const saveResponse = await fetch('/api/curator/save-president-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "truman-harry-s": updatedData
        })
      });

      if (saveResponse.ok) {
        // Trigger automatic data ingestion pipeline
        const ingestResponse = await fetch('/api/curator/trigger-ingestion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            voyage_id: voyageWithUploadedMedia.voyage,
            action: editMode === 'add' ? 'create' : 'update'
          })
        });

        if (ingestResponse.ok) {
          console.log('Data ingestion triggered successfully');
        }

        // Update local state
        setRawData({
          "truman-harry-s": updatedData
        });
        setData(updatedData);

        setEditMode('view');
        setSelectedVoyage(null);
      } else {
        throw new Error('Failed to save voyage data');
      }
    } catch (error) {
      console.error('Save failed:', error);
      setError(`Failed to save: ${error}`);
    }
  };

  const addPassenger = (voyage: Voyage): Voyage => {
    return {
      ...voyage,
      passengers: [
        ...voyage.passengers,
        {
          name: "",
          full_name: "",
          title: "",
          role: "",
          bio: ""
        }
      ]
    };
  };

  const addMediaItem = (voyage: Voyage): Voyage => {
    return {
      ...voyage,
      media: [
        ...(voyage.media || []),
        {
          media_name: "",
          link: "",
          source: "",
          date: "",
          type: "",
          link_type: ""
        }
      ]
    };
  };

  const uploadMediaFiles = async (voyage: Voyage): Promise<Voyage> => {
    if (!voyage.media) return voyage;

    const updatedMedia = [...voyage.media];
    
    for (let i = 0; i < updatedMedia.length; i++) {
      const mediaItem = updatedMedia[i];
      if (mediaItem.file) {
        try {
          // Upload to S3 via backend
          const formData = new FormData();
          formData.append('file', mediaItem.file);
          formData.append('voyage_id', voyage.voyage);
          formData.append('source', mediaItem.source || '');
          formData.append('media_name', mediaItem.media_name || '');

          const response = await fetch('/api/curator/upload-media', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const result = await response.json();
            updatedMedia[i] = {
              ...mediaItem,
              s3_path: result.s3_path,
              link: result.public_url || "",
              file: null // Clear the file object after upload
            };
          } else {
            console.error('Failed to upload media file:', mediaItem.file.name);
          }
        } catch (error) {
          console.error('Error uploading media:', error);
        }
      }
    }

    return {
      ...voyage,
      media: updatedMedia
    };
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-700">{error}</p>
            <button
              onClick={loadPresidentData}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

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
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Access Curator Interface
              </button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-gray-500">No data available</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-blue-800 mb-2">
            Historical Curator - Harry S. Truman
          </h1>
          <p className="text-gray-600">
            Democratic • {data.term_start} - {data.term_end}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {data.voyages.length} voyage{data.voyages.length !== 1 ? 's' : ''} recorded
          </p>
        </div>

        {editMode === 'view' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Voyages</h2>
                <button
                  onClick={() => {
                    setSelectedVoyage(createNewVoyage());
                    setEditMode('add');
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Add Voyage
                </button>
              </div>
            
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data?.voyages?.map((voyage: Voyage, index: number) => (
                  <div
                    key={voyage.voyage}
                    onClick={() => {
                      setSelectedVoyage(voyage);
                      setEditMode('view');
                    }}
                    className="p-3 border rounded cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="font-medium text-blue-600">{voyage.voyage}</h3>
                    <p className="text-sm text-gray-600">
                      {voyage.start_date || 'Date unknown'} • {voyage.passengers.length} passengers
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {selectedVoyage && (
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
                      onClick={() => setSelectedVoyage(null)}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">
                    {formatVoyagePreview(selectedVoyage)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {(editMode === 'edit' || editMode === 'add') && selectedVoyage && (
          <VoyageEditor
            voyage={selectedVoyage}
            onSave={saveVoyage}
            onCancel={() => {
              setEditMode('view');
              setSelectedVoyage(null);
            }}
            onAddPassenger={addPassenger}
            onAddMedia={addMediaItem}
            isNew={editMode === 'add'}
          />
        )}
      </div>
    </div>
    </Layout>
  );
};

interface VoyageEditorProps {
  voyage: Voyage;
  onSave: (voyage: Voyage) => void;
  onCancel: () => void;
  onAddPassenger: (voyage: Voyage) => Voyage;
  onAddMedia: (voyage: Voyage) => Voyage;
  isNew: boolean;
}

const VoyageEditor: React.FC<VoyageEditorProps> = ({
  voyage: initialVoyage,
  onSave,
  onCancel,
  onAddPassenger,
  onAddMedia,
  isNew
}) => {
  const [voyage, setVoyage] = useState<Voyage>(initialVoyage);

  const handleSave = () => {
    onSave(voyage);
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: string) => {
    const updatedPassengers = [...voyage.passengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };
    setVoyage({ ...voyage, passengers: updatedPassengers });
  };

  const updateMedia = (index: number, field: keyof MediaItem, value: string | File | null) => {
    const updatedMedia = [...(voyage.media || [])];
    updatedMedia[index] = { ...updatedMedia[index], [field]: value };
    setVoyage({ ...voyage, media: updatedMedia });
  };

  const removePassenger = (index: number) => {
    const updatedPassengers = voyage.passengers.filter((_, i) => i !== index);
    setVoyage({ ...voyage, passengers: updatedPassengers });
  };

  const removeMedia = (index: number) => {
    const updatedMedia = (voyage.media || []).filter((_, i) => i !== index);
    setVoyage({ ...voyage, media: updatedMedia });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {isNew ? 'Add New Voyage' : 'Edit Voyage'}
        </h2>
        <div className="space-x-2">
          <button
            onClick={handleSave}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voyage ID
            </label>
            <input
              type="text"
              value={voyage.voyage}
              onChange={(e) => setVoyage({ ...voyage, voyage: e.target.value })}
              className="w-full border rounded px-3 py-2"
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
                value={voyage.origin || ''}
                onChange={(e) => setVoyage({ ...voyage, origin: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destination
              </label>
              <input
                type="text"
                value={voyage.destination || ''}
                onChange={(e) => setVoyage({ ...voyage, destination: e.target.value || null })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary
            </label>
            <textarea
              value={voyage.notes?.join('\n') || ''}
              onChange={(e) => setVoyage({ ...voyage, notes: e.target.value.split('\n').filter(n => n.trim()) })}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={voyage.notes?.join('\n') || ''}
              onChange={(e) => setVoyage({ ...voyage, notes: e.target.value.split('\n').filter(n => n.trim()) })}
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-gray-800">Passengers</h3>
              <button
                onClick={() => setVoyage(onAddPassenger(voyage))}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Add Passenger
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {voyage.passengers.map((passenger, index) => (
                <div key={index} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Passenger {index + 1}</span>
                    <button
                      onClick={() => removePassenger(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={passenger.name}
                      onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={passenger.full_name}
                      onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Role/Title"
                      value={passenger.role || ''}
                      onChange={(e) => updatePassenger(index, 'role', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="url"
                      placeholder="Wikipedia URL"
                      value={passenger.bio || ''}
                      onChange={(e) => updatePassenger(index, 'bio', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium text-gray-800">Media</h3>
              <button
                onClick={() => setVoyage(onAddMedia(voyage))}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              >
                Add Media
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {voyage.media?.map((media, index) => (
                <div key={index} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Media {index + 1}</span>
                    <button
                      onClick={() => removeMedia(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="file"
                      accept="image/*,video/*,audio/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        updateMedia(index, 'file', file);
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Credit/Source"
                      value={media.source}
                      onChange={(e) => updateMedia(index, 'source', e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <textarea
                      placeholder="Description"
                      value={media.media_name}
                      onChange={(e) => updateMedia(index, 'media_name', e.target.value)}
                      rows={2}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    {media.s3_path && (
                      <div className="text-xs text-green-600">
                        Uploaded: {media.s3_path}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonCuratorInterface;