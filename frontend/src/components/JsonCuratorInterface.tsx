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
  // Metadata flags
  has_photo?: boolean;
  has_video?: boolean;
  presidential_use?: boolean;
  has_royalty?: boolean;
  has_foreign_leader?: boolean;
  mention_camp_david?: boolean;
  mention_mount_vernon?: boolean;
  mention_captain?: boolean;
  mention_crew?: boolean;
  mention_rmd?: boolean;
  mention_yacht_spin?: boolean;
  mention_menu?: boolean;
  mention_drinks_wine?: boolean;
  // Associated text fields
  presidential_initials?: string | null;
  royalty_details?: string | null;
  foreign_leader_country?: string | null;
}

interface PresidentData {
  term_start: string;
  term_end: string;
  info: string;
  voyages: Voyage[];
  president?: {
    full_name: string;
    party: string;
    slug: string;
    term_start: string;
    term_end: string;
  };
}

interface AllPresidentsData {
  [key: string]: PresidentData;
}

// Media explorer interfaces
interface FileItem {
  name: string;
  type: 'folder' | 'file';
  size?: string;
  lastModified?: string;
  extension?: string;
  s3Url?: string;
}

const JsonCuratorInterface: React.FC = () => {
  const [rawData, setRawData] = useState<AllPresidentsData | null>(null);
  const [data, setData] = useState<PresidentData | null>(null);
  const [selectedPresident, setSelectedPresident] = useState<string>('truman-harry');
  const [selectedVoyage, setSelectedVoyage] = useState<Voyage | null>(null);
  const [editMode, setEditMode] = useState<'view' | 'edit' | 'add'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<'editor' | 'media'>('editor');
  const [ingestionProgress, setIngestionProgress] = useState<{
    isActive: boolean;
    operationId: string | null;
    progress: number;
    currentStep: string;
    status: 'initializing' | 'running' | 'completed' | 'failed';
  }>({
    isActive: false,
    operationId: null,
    progress: 0,
    currentStep: '',
    status: 'initializing'
  });

  // Media explorer state
  const [currentPath, setCurrentPath] = useState('/');
  const [mediaItems, setMediaItems] = useState<FileItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [s3Structure, setS3Structure] = useState<Record<string, FileItem[]>>({});
  const [structureLoading, setStructureLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadPresidentData();
      loadS3Structure();
    }
  }, [isAuthenticated]);

  // Load S3 structure for media explorer
  useEffect(() => {
    const loadDirectory = async () => {
      if (structureLoading) return;

      setMediaLoading(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      const directoryItems = s3Structure[currentPath] || [];
      setMediaItems(directoryItems);
      setMediaLoading(false);
    };

    if (Object.keys(s3Structure).length > 0) {
      loadDirectory();
    }
  }, [currentPath, s3Structure, structureLoading]);

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
      const response = await fetch('/canonical_timeline.json');
      if (!response.ok) {
        throw new Error('Failed to load president data');
      }
      const jsonData = await response.json();
      setRawData(jsonData);

      // Load the selected president's data
      loadSelectedPresident(jsonData, selectedPresident);
    } catch (error) {
      console.error('Failed to load president data:', error);
      setError(`Failed to load data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedPresident = (allData: AllPresidentsData, presidentSlug: string) => {
    const presidentData = allData[presidentSlug];
    if (presidentData) {
      setData({
        ...presidentData,
        president: {
          full_name: getPresidentDisplayName(presidentSlug),
          party: "Democratic Party", // Default, could be improved with actual party data
          slug: presidentSlug,
          term_start: presidentData.term_start,
          term_end: presidentData.term_end
        }
      });
      setSelectedVoyage(null); // Clear selected voyage when switching presidents
    }
  };

  const getPresidentDisplayName = (slug: string): string => {
    const nameMap: {[key: string]: string} = {
      "truman-harry": "Harry S. Truman",
      "roosevelt-franklin": "Franklin D. Roosevelt",
      "carter-jimmy": "Jimmy Carter",
      "reagan-ronald": "Ronald Reagan",
      "bush-george-w": "George W. Bush",
      "obama-barack": "Barack Obama",
      "kennedy-john": "John F. Kennedy",
      "johnson-lyndon": "Lyndon B. Johnson",
      "hoover-herbert": "Herbert Hoover",
      "eisenhower-dwight": "Dwight D. Eisenhower",
      "nixon-richard": "Richard Nixon",
      "ford-gerald": "Gerald Ford",
      "dunning-william": "William Dunning",
      "cadwalader-emily": "Emily Cadwalader"
    };
    return nameMap[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getChronologicallyOrderedPresidents = (): string[] => {
    if (!rawData) return [];

    const presidentsWithDates = Object.keys(rawData).map(slug => ({
      slug,
      termStart: rawData[slug].term_start
    }));

    // Sort by term start date
    presidentsWithDates.sort((a, b) => {
      // Handle different date formats and extract year for sorting
      const getYear = (dateStr: string): number => {
        if (!dateStr) return 9999; // Put entries with no date at end
        // Extract year from formats like "March 4, 1933", "1933-03-04", "April 12, 1945"
        const yearMatch = dateStr.match(/\d{4}/);
        return yearMatch ? parseInt(yearMatch[0]) : 9999;
      };

      return getYear(a.termStart) - getYear(b.termStart);
    });

    return presidentsWithDates.map(p => p.slug);
  };

  const handlePresidentChange = (presidentSlug: string) => {
    setSelectedPresident(presidentSlug);
    if (rawData) {
      loadSelectedPresident(rawData, presidentSlug);
    }
  };

  const pollIngestionStatus = async (operationId: string) => {
    try {
      const response = await fetch(`/api/curator/ingest-status/${operationId}`);
      if (response.ok) {
        const status = await response.json();
        setIngestionProgress({
          isActive: status.status === 'running' || status.status === 'initializing',
          operationId,
          progress: status.progress || 0,
          currentStep: status.current_step || '',
          status: status.status
        });

        // Continue polling if still running
        if (status.status === 'running' || status.status === 'initializing') {
          setTimeout(() => pollIngestionStatus(operationId), 1000); // Poll every second
        } else {
          // Ingestion completed or failed
          setTimeout(() => {
            setIngestionProgress(prev => ({ ...prev, isActive: false }));
          }, 3000); // Hide after 3 seconds
        }
      }
    } catch (error) {
      console.error('Failed to poll ingestion status:', error);
      setIngestionProgress(prev => ({ ...prev, isActive: false }));
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
      voyage: `truman-harry-${year}-new-${voyageCount + 1}`,
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
    console.log('saveVoyage called', { updatedVoyage, data, selectedPresident });
    if (!data) {
      console.log('No data, returning early');
      return;
    }

    try {
      console.log('Starting save process...');
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
      console.log('Sending save request...', { selectedPresident, updatedData });
      const saveResponse = await fetch('/api/curator/save-president-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [selectedPresident]: updatedData
        })
      });

      console.log('Save response received:', saveResponse.status, saveResponse.statusText);
      if (saveResponse.ok) {
        const saveResult = await saveResponse.json();

        // Check if ingestion was triggered and get operation ID
        if (saveResult.operation_id) {
          setIngestionProgress({
            isActive: true,
            operationId: saveResult.operation_id,
            progress: 0,
            currentStep: 'Starting ingestion...',
            status: 'initializing'
          });

          // Start polling for ingestion progress
          pollIngestionStatus(saveResult.operation_id);
        }

        // Update local state
        if (rawData) {
          setRawData({
            ...rawData,
            [selectedPresident]: updatedData
          });
        }
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

  // Media explorer functions
  const loadS3Structure = async () => {
    setStructureLoading(true);
    setMediaError(null);
    try {
      const response = await fetch('/api/curator/s3-structure');
      if (response.ok) {
        const data = await response.json();
        setS3Structure(data.structure);
      } else {
        setMediaError(`Failed to load S3 structure (HTTP ${response.status})`);
        // Fallback structure
        setS3Structure({
          '/': [{ name: 'media', type: 'folder' }],
          '/media/': [
            { name: 'roosevelt-franklin', type: 'folder' },
            { name: 'truman-harry', type: 'folder' },
            { name: 'eisenhower-dwight', type: 'folder' }
          ]
        });
      }
    } catch (error) {
      setMediaError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setS3Structure({
        '/': [{ name: 'media', type: 'folder' }]
      });
    } finally {
      setStructureLoading(false);
    }
  };

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
  };

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'folder') {
      const newPath = currentPath === '/' ? `/${item.name}/` : `${currentPath}${item.name}/`;
      navigateToPath(newPath);
    } else if (item.type === 'file' && item.s3Url) {
      openFile(item);
    }
  };

  const openFile = async (item: FileItem) => {
    try {
      const presignedUrl = await getPresignedUrl(item.s3Url!);
      window.open(presignedUrl, '_blank');
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const getPresignedUrl = async (s3Url: string): Promise<string> => {
    const response = await fetch('/api/curator/presign-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ s3_url: s3Url }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.presigned_url;
  };

  const getBreadcrumbs = () => {
    if (currentPath === '/') return [{ name: 'Root', path: '/' }];

    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Root', path: '/' }];

    let currentBreadcrumbPath = '';
    parts.forEach((part, index) => {
      currentBreadcrumbPath += `/${part}`;
      if (index < parts.length - 1 || currentPath.endsWith('/')) {
        currentBreadcrumbPath += '/';
      }
      breadcrumbs.push({ name: part, path: currentBreadcrumbPath });
    });

    return breadcrumbs;
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') return '📁';

    switch (item.extension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'mp4':
      case 'avi':
      case 'mov':
        return '🎥';
      case 'mp3':
      case 'wav':
      case 'flac':
        return '🎵';
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      default:
        return '📄';
    }
  };

  const filteredMediaItems = mediaItems.filter(item =>
    searchQuery.trim() === '' ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-blue-800 mb-2">
                Historical Curator - {data.president?.full_name}
              </h1>
              <p className="text-gray-600">
                {data.president?.party || "Party Unknown"} • {data.term_start} - {data.term_end}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {data.voyages.length} voyage{data.voyages.length !== 1 ? 's' : ''} recorded
              </p>
            </div>
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select President
              </label>
              <select
                value={selectedPresident}
                onChange={(e) => handlePresidentChange(e.target.value)}
                className="w-56 border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getChronologicallyOrderedPresidents().map(presidentSlug => (
                  <option key={presidentSlug} value={presidentSlug}>
                    {getPresidentDisplayName(presidentSlug)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ingestion Progress Bar */}
        {ingestionProgress.isActive && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-blue-800">Processing Voyage Data</h3>
              <span className="text-sm text-gray-500">{ingestionProgress.progress}%</span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  ingestionProgress.status === 'failed' ? 'bg-red-500' :
                  ingestionProgress.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${ingestionProgress.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{ingestionProgress.currentStep}</span>
              <div className="flex items-center">
                {ingestionProgress.status === 'running' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                )}
                <span className={`font-medium ${
                  ingestionProgress.status === 'failed' ? 'text-red-600' :
                  ingestionProgress.status === 'completed' ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {ingestionProgress.status === 'initializing' ? 'Starting...' :
                   ingestionProgress.status === 'running' ? 'Processing...' :
                   ingestionProgress.status === 'completed' ? 'Completed!' : 'Failed'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('editor')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'editor'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Voyage Editor
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'media'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Media Explorer
              </button>
            </nav>
          </div>
        </div>

        {/* Voyage Editor Tab */}
        {activeTab === 'editor' && editMode === 'view' && (
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

        {activeTab === 'editor' && (editMode === 'edit' || editMode === 'add') && selectedVoyage && (
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

        {/* Media Explorer Tab */}
        {activeTab === 'media' && (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-6">
              <div className="md:flex md:items-center md:justify-between mb-6">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                    Media Archive
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Live S3 bucket contents from sequoia-canonical
                  </p>
                  {mediaError ? (
                    <p className="mt-1 text-xs text-red-500">
                      ⚠️ {mediaError}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">
                      Current path: {currentPath} | Items: {mediaItems.length} | Directories loaded: {Object.keys(s3Structure).length}
                    </p>
                  )}
                </div>
              </div>

              {/* Breadcrumbs */}
              <nav className="flex mb-4" aria-label="Breadcrumb">
                <ol className="inline-flex items-center space-x-1 md:space-x-3">
                  {getBreadcrumbs().map((crumb, index) => (
                    <li key={crumb.path} className="inline-flex items-center">
                      {index > 0 && (
                        <span className="mx-2 text-gray-400">/</span>
                      )}
                      <button
                        onClick={() => navigateToPath(crumb.path)}
                        className={`${
                          crumb.path === currentPath
                            ? 'text-gray-700 font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                        } text-sm`}
                      >
                        {crumb.name}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>

              {/* Search */}
              <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Structure Loading */}
              {structureLoading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading S3 bucket structure...</p>
                </div>
              )}

              {/* Directory Loading */}
              {!structureLoading && mediaLoading && (
                <div className="text-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading directory contents...</p>
                </div>
              )}

              {/* File List */}
              {!structureLoading && !mediaLoading && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between text-sm font-medium text-gray-500">
                      <span>Name</span>
                      <div className="flex space-x-8">
                        <span>Size</span>
                        <span>Modified</span>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {filteredMediaItems.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500">
                        {searchQuery ? 'No files match your search.' : 'This directory is empty.'}
                      </div>
                    ) : (
                      filteredMediaItems.map((item, index) => (
                        <div
                          key={index}
                          onClick={() => handleItemClick(item)}
                          className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-colors ${
                            item.type === 'folder'
                              ? 'hover:bg-blue-50 border-l-4 border-l-transparent hover:border-l-blue-200'
                              : item.s3Url
                                ? 'hover:bg-green-50 border-l-4 border-l-transparent hover:border-l-green-200'
                                : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="text-xl mr-3">{getFileIcon(item)}</span>
                            <span
                              className={`font-medium ${
                                item.type === 'folder'
                                  ? 'text-blue-600'
                                  : item.s3Url
                                    ? 'text-green-600'
                                    : 'text-gray-900'
                              }`}
                            >
                              {item.name}
                              {item.s3Url && (
                                <span className="ml-2 text-xs text-green-500">
                                  📂 Click to open
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center space-x-8 text-sm text-gray-500">
                            <span className="w-16 text-right">
                              {item.size || (item.type === 'folder' ? '—' : '—')}
                            </span>
                            <span className="w-20 text-right">
                              {item.lastModified || '—'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="mt-6 text-sm text-gray-500">
                <p>
                  Showing {filteredMediaItems.length} items •
                  Folders: {filteredMediaItems.filter(i => i.type === 'folder').length} •
                  Files: {filteredMediaItems.filter(i => i.type === 'file').length}
                </p>
              </div>
            </div>
          </div>
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
    console.log('handleSave clicked', voyage);
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

          {/* Metadata Flags Section */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Voyage Metadata</h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Boolean checkboxes */}
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.has_photo || false}
                  onChange={(e) => setVoyage({ ...voyage, has_photo: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Photo(s)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.has_video || false}
                  onChange={(e) => setVoyage({ ...voyage, has_video: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Video(s)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.has_royalty || false}
                  onChange={(e) => setVoyage({ ...voyage, has_royalty: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Royalty</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.has_foreign_leader || false}
                  onChange={(e) => setVoyage({ ...voyage, has_foreign_leader: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Foreign Leader</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.mention_camp_david || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_camp_david: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Camp David (CD)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.mention_mount_vernon || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_mount_vernon: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Mount Vernon (MV)</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.mention_captain || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_captain: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Captain</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.mention_crew || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_crew: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Crew</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.mention_rmd || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_rmd: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">RMD</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.mention_yacht_spin || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_yacht_spin: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Yacht Spin</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.mention_menu || false}
                  onChange={(e) => setVoyage({ ...voyage, mention_menu: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Menu</span>
              </label>

              <label className="flex items-center space-x-2">
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
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voyage.presidential_use || false}
                  onChange={(e) => setVoyage({ ...voyage, presidential_use: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium">Presidential Use</span>
              </label>
              {voyage.presidential_use && (
                <input
                  type="text"
                  placeholder="Presidential Initials (e.g., HST, FDR)"
                  value={voyage.presidential_initials || ''}
                  onChange={(e) => setVoyage({ ...voyage, presidential_initials: e.target.value || null })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              )}

              {voyage.has_royalty && (
                <input
                  type="text"
                  placeholder="Royalty Details"
                  value={voyage.royalty_details || ''}
                  onChange={(e) => setVoyage({ ...voyage, royalty_details: e.target.value || null })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              )}

              {voyage.has_foreign_leader && (
                <input
                  type="text"
                  placeholder="Foreign Leader Country"
                  value={voyage.foreign_leader_country || ''}
                  onChange={(e) => setVoyage({ ...voyage, foreign_leader_country: e.target.value || null })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              )}
            </div>
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