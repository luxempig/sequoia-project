import React, { useState, useEffect } from 'react';
import Layout from './Layout';

interface VoyageData {
  president?: {
    president_slug: string;
    full_name: string;
    party: string;
    term_start: string;
    term_end: string;
    wikipedia_url?: string;
    tags?: string;
  };
  voyage?: {
    title: string;
    start_date: string;
    origin?: string;
    vessel_name?: string;
    summary?: string;
    tags?: string;
  };
  passengers?: Array<{
    slug: string;
    full_name: string;
    role_title?: string;
    wikipedia_url?: string;
  }>;
  media?: Array<{
    credit: string;
    date?: string;
    google_drive_link?: string;
    description?: string;
    tags?: string;
  }>;
}

const CuratorDocument: React.FC = () => {
  const [content, setContent] = useState('');
  const [parsedData, setParsedData] = useState<VoyageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ingestProgress, setIngestProgress] = useState<{
    active: boolean;
    message: string;
    percent: number;
  } | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        // Load canonical_voyages.json
        const response = await fetch('/api/curator/canonical-voyages');
        if (response.ok) {
          const jsonData = await response.json();
          const jsonContent = JSON.stringify(jsonData, null, 2);
          setContent(jsonContent);
          setOriginalContent(jsonContent);
          setError(null);
        } else {
          console.error('Failed to load canonical_voyages.json from backend, status:', response.status);
          setError(`Failed to load canonical_voyages.json (HTTP ${response.status})`);
          const errorContent = JSON.stringify({
            "error": "Failed to load canonical_voyages.json",
            "status": response.status,
            "note": "Please check that backend is running and canonical_voyages.json exists"
          }, null, 2);

          setContent(errorContent);
          setOriginalContent(errorContent);
        }
      } catch (error) {
        console.error('Failed to load content:', error);
        setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  const parseContent = (text: string) => {
    // Validate JSON and extract summary info for display
    try {
      const data = JSON.parse(text);
      const parsed: VoyageData[] = [];

      // Extract basic info from canonical_voyages.json structure
      Object.entries(data).forEach(([presidentSlug, presidentData]: [string, any]) => {
        if (presidentData && typeof presidentData === 'object' && presidentData.voyages) {
          presidentData.voyages.forEach((voyage: any) => {
            parsed.push({
              president: {
                president_slug: presidentSlug,
                full_name: presidentData.full_name || presidentSlug,
                party: presidentData.party || '',
                term_start: presidentData.term_start || '',
                term_end: presidentData.term_end || '',
                wikipedia_url: presidentData.wikipedia_url,
                tags: presidentData.tags
              },
              voyage: {
                title: voyage.title || '',
                start_date: voyage.start_date || '',
                origin: voyage.origin,
                vessel_name: voyage.vessel_name,
                summary: voyage.summary_markdown,
                tags: voyage.tags
              }
            });
          });
        }
      });

      setParsedData(parsed);
    } catch (e) {
      // Invalid JSON, clear parsed data
      setParsedData([]);
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== originalContent);
    parseContent(newContent);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Validate JSON before saving
      let jsonData;
      try {
        jsonData = JSON.parse(content);
      } catch (parseError) {
        throw new Error(`Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
      }

      // Save to canonical_voyages.json WITHOUT triggering ingest
      const response = await fetch('/api/curator/canonical-voyages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      if (response.ok) {
        const result = await response.json();
        setOriginalContent(content);
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
        setError(null);

        // No ingest triggered - just saved the JSON file
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Save failed: ${errorData.detail || `HTTP ${response.status}`}`);
      }
    } catch (error) {
      console.error('Failed to save:', error);
      setError(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const pollIngestStatus = async (operationId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/curator/ingest-status/${operationId}`);
        if (response.ok) {
          const status = await response.json();

          setIngestProgress({
            active: status.status === 'running' || status.status === 'pending',
            message: status.current_step || status.status,
            percent: status.progress_percent || 0
          });

          if (status.status === 'completed') {
            setTimeout(() => setIngestProgress(null), 3000); // Clear after 3 seconds
          } else if (status.status === 'failed') {
            setError(`Ingest failed: ${status.error || 'Unknown error'}`);
            setIngestProgress(null);
          } else if (status.status === 'running' || status.status === 'pending') {
            // Continue polling
            setTimeout(poll, 2000);
          }
        }
      } catch (e) {
        console.error('Failed to poll ingest status:', e);
      }
    };

    poll();
  };

  const handleRevert = () => {
    setContent(originalContent);
    setHasUnsavedChanges(false);
    parseContent(originalContent);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading canonical_voyages.json...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Ingest Progress Bar */}
        {ingestProgress?.active && (
          <div className="mb-6 bg-blue-50 border border-blue-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                🔄 {ingestProgress.message}
              </span>
              <span className="text-sm text-blue-700">{ingestProgress.percent}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${ingestProgress.percent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              For Curators
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Edit voyage data in canonical_voyages.json
            </p>
            {error ? (
              <p className="mt-1 text-xs text-red-500">
                ⚠️ {error}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                Parsed entries: {parsedData.length} | Content length: {content.length} chars
                {hasUnsavedChanges && <span className="text-orange-600 font-medium"> • Unsaved changes</span>}
              </p>
            )}
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium transition-colors ${
                editMode 
                  ? 'text-white bg-gray-900 hover:bg-gray-800' 
                  : 'text-gray-700 bg-white hover:bg-gray-50'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900`}
            >
              {editMode ? '📖 View Mode' : '✏️ Edit Mode'}
            </button>
            {editMode && hasUnsavedChanges && (
              <button
                onClick={handleRevert}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                ↩️ Revert
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors ${
                hasUnsavedChanges 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50`}
            >
              {saving ? '💾 Saving...' : hasUnsavedChanges ? '💾 Save Changes' : '✅ Saved'}
            </button>
          </div>
        </div>

        {/* Guidance Panel */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">📖 How This Works</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>1. Edit the JSON data</strong> - Click "Edit Mode" to modify voyage information, media links, and passenger details
            </p>
            <p>
              <strong>2. Save changes</strong> - Click "Save Changes" to write to canonical_voyages.json
            </p>
            <p>
              <strong>3. Changes persist immediately</strong> - Your edits are saved to the source file and will be visible in this editor
            </p>
            <p className="text-amber-700 bg-amber-100 px-2 py-1 rounded">
              ⚠️ <strong>Note:</strong> Saving does NOT trigger database ingestion. Changes will NOT appear on the public website until an ingest is run separately (this avoids 4+ minute waits for each save).
            </p>
          </div>
        </div>

        {(lastSaved || hasUnsavedChanges) && (
          <div className="mb-4 flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg border">
            {lastSaved && (
              <div className="text-sm text-gray-600">
                ✅ Last saved: {lastSaved.toLocaleString()}
              </div>
            )}
            {hasUnsavedChanges && (
              <div className="text-sm text-orange-600 font-medium">
                ⚠️ You have unsaved changes
              </div>
            )}
          </div>
        )}

        {editMode ? (
          /* Raw Editor Mode */
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="p-1">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                MASTER_DOC.md (Raw Edit Mode)
              </div>
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full p-6 font-mono text-sm text-gray-900 bg-white border-0 resize-none focus:ring-0 focus:outline-none overflow-y-auto"
                  style={{ 
                    lineHeight: '1.6', 
                    tabSize: 2,
                    height: '75vh',
                    minHeight: '600px'
                  }}
                  placeholder="Enter your MASTER_DOC content here..."
                />
                {hasUnsavedChanges && (
                  <div className="absolute top-2 right-2 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                    Unsaved
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Formatted View Mode */
          <div className="space-y-6 max-h-[75vh] overflow-y-auto bg-gray-50 p-4 rounded-lg border">
            {parsedData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">📄</div>
                <p className="text-lg">No voyage data found</p>
                <p className="text-sm">Switch to Edit Mode to add content</p>
              </div>
            ) : (
              parsedData.map((entry, index) => (
              <div key={index} className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {entry.voyage?.title || `Voyage Record ${index + 1}`}
                  </h3>
                  {entry.voyage?.start_date && (
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(entry.voyage.start_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>

                <div className="p-6 space-y-6">
                  {entry.president && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                        President
                      </h4>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-blue-900">{entry.president.full_name}</h5>
                            <p className="text-sm text-blue-700">{entry.president.party} Party</p>
                            <p className="text-sm text-blue-600">
                              {entry.president.term_start} - {entry.president.term_end}
                            </p>
                          </div>
                          {entry.president.wikipedia_url && (
                            <a
                              href={entry.president.wikipedia_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Wikipedia →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {entry.voyage && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                        Voyage Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {entry.voyage.origin && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Origin</label>
                            <p className="text-sm text-gray-900">{entry.voyage.origin}</p>
                          </div>
                        )}
                        {entry.voyage.vessel_name && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Vessel</label>
                            <p className="text-sm text-gray-900">{entry.voyage.vessel_name}</p>
                          </div>
                        )}
                      </div>
                      {entry.voyage.summary && (
                        <div className="mt-4">
                          <label className="text-xs font-medium text-gray-500 uppercase">Summary</label>
                          <p className="text-sm text-gray-900 mt-1 leading-relaxed">{entry.voyage.summary}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {entry.passengers && entry.passengers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                        Passengers ({entry.passengers.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {entry.passengers.map((passenger, pIndex) => (
                          <div key={pIndex} className="bg-gray-50 rounded-lg p-3">
                            <h6 className="font-medium text-gray-900">{passenger.full_name}</h6>
                            {passenger.role_title && (
                              <p className="text-sm text-gray-600">{passenger.role_title}</p>
                            )}
                            {passenger.wikipedia_url && (
                              <a
                                href={passenger.wikipedia_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs"
                              >
                                Wikipedia →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {entry.media && entry.media.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                        Media ({entry.media.length})
                      </h4>
                      <div className="space-y-2">
                        {entry.media.map((mediaItem, mIndex) => (
                          <div key={mIndex} className="bg-yellow-50 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-yellow-900">{mediaItem.credit}</p>
                              {mediaItem.date && (
                                <p className="text-sm text-yellow-700">{mediaItem.date}</p>
                              )}
                              {mediaItem.description && (
                                <p className="text-sm text-yellow-700 mt-1">{mediaItem.description}</p>
                              )}
                            </div>
                            {mediaItem.google_drive_link && (
                              <a
                                href={mediaItem.google_drive_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-yellow-600 hover:text-yellow-800 text-sm"
                              >
                                View →
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CuratorDocument;