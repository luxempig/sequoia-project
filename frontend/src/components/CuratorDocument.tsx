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

  useEffect(() => {
    const loadContent = async () => {
      try {
        // Try to fetch from backend API first
        const response = await fetch('/api/curator/master-doc');
        if (response.ok) {
          const docContent = await response.text();
          setContent(docContent);
          parseContent(docContent);
        } else {
          console.error('Failed to load MASTER_DOC from backend, status:', response.status);
          const errorContent = `## ERROR: Failed to load MASTER_DOC

Could not load the master document from backend API.
Status: ${response.status}

Please check:
- Backend is running
- /api/curator/master-doc endpoint is accessible
- MASTER_DOC.md file exists in backend/tools/

## Sample Entry (Fallback)

president_slug: roosevelt-franklin
full_name: Franklin D. Roosevelt
party: Democratic
term_start: 1933-03-04
term_end: 1945-04-12`;
          
          setContent(errorContent);
          parseContent(errorContent);
        }
      } catch (error) {
        console.error('Failed to load content:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  const parseContent = (text: string) => {
    // Simple parser for the structured document format
    const sections = text.split('---').map(s => s.trim()).filter(Boolean);
    const parsed: VoyageData[] = [];
    let currentEntry: VoyageData = {};

    sections.forEach(section => {
      const lines = section.split('\n').filter(l => l.trim());
      
      lines.forEach(line => {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('## President')) {
          if (Object.keys(currentEntry).length > 0) {
            parsed.push(currentEntry);
          }
          currentEntry = {};
        } else if (trimmed.startsWith('## Voyage')) {
          // Continue with current entry
        } else if (trimmed.startsWith('## Passengers')) {
          // Continue with current entry
        } else if (trimmed.startsWith('## Media')) {
          // Continue with current entry
        } else if (trimmed.includes(':')) {
          const [key, ...valueParts] = trimmed.split(':');
          const value = valueParts.join(':').trim();
          
          if (key.includes('president_slug') || key.includes('full_name') || key.includes('party')) {
            if (!currentEntry.president) currentEntry.president = {} as any;
            (currentEntry.president as any)[key] = value;
          } else if (key.includes('title') || key.includes('start_date') || key.includes('origin')) {
            if (!currentEntry.voyage) currentEntry.voyage = {} as any;
            (currentEntry.voyage as any)[key] = value;
          }
        }
      });
    });

    if (Object.keys(currentEntry).length > 0) {
      parsed.push(currentEntry);
    }
    
    setParsedData(parsed);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In real implementation, save to backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading master document...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              For Curators
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              USS Sequoia Master Document - Live MASTER_DOC.md content
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Parsed entries: {parsedData.length} | Content length: {content.length} chars
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
            <button
              onClick={() => setEditMode(!editMode)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
            >
              {editMode ? 'View Mode' : 'Edit Mode'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {lastSaved && (
          <div className="mb-4 text-sm text-gray-500">
            Last saved: {lastSaved.toLocaleTimeString()}
          </div>
        )}

        {editMode ? (
          /* Raw Editor Mode */
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="p-1">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                MASTER_DOC.md (Raw Edit Mode)
              </div>
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  parseContent(e.target.value);
                }}
                className="w-full p-6 font-mono text-sm text-gray-900 bg-white border-0 resize-none focus:ring-0 focus:outline-none overflow-y-auto"
                style={{ 
                  lineHeight: '1.5', 
                  tabSize: 2,
                  height: '80vh',
                  minHeight: '600px'
                }}
              />
            </div>
          </div>
        ) : (
          /* Formatted View Mode */
          <div className="space-y-6 max-h-[80vh] overflow-y-auto">
            {parsedData.map((entry, index) => (
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
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CuratorDocument;