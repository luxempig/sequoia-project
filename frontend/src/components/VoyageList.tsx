import { api } from "../api";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "./Layout";
import VoyageCard from "./VoyageCard";
import VoyageCardExpanded from "./VoyageCardExpanded";
import HorizontalTimeline from "./HorizontalTimeline";
import { Voyage, President } from "../types";

const Badge: React.FC<{ tone?: "amber" | "violet"; children: React.ReactNode }> = ({
  tone = "amber",
  children,
}) => (
  <span
    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md ring-1
       ${
         tone === "amber"
           ? "bg-amber-100 text-amber-800 ring-amber-200"
           : "bg-violet-100 text-violet-800 ring-violet-200"
       }`}
  >
    {children}
  </span>
);

// Generate consistent color for each tag
const getTagColor = (tag: string) => {
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
  ];

  // Hash tag name to get consistent color
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function VoyageList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Pagination state
  const [page, setPage] = useState(() => {
    const pageParam = params.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  const pageSize = 50; // Items per page

  const [q, setQ] = useState(() => params.get("q") || "");
  const [df, setDF] = useState(() => params.get("date_from") || "");
  const [dt, setDT] = useState(() => params.get("date_to") || "");
  const [pres, setPres] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('voyageListPresidentFilter');
    return saved ? JSON.parse(saved) : [];
  });
  const [sig, setSig] = useState(params.get("significant") === "1");
  const [roy, setRoy] = useState(params.get("royalty") === "1");
  // Boolean field filters - initialize from sessionStorage
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(() => {
    const saved = sessionStorage.getItem('voyageListFilters');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [presidentDropdownOpen, setPresidentDropdownOpen] = useState(false);

  const [presidents, setPrez] = useState<President[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>(() => {
    const saved = sessionStorage.getItem('voyageListViewMode');
    return (saved === 'timeline' ? 'timeline' : 'list') as 'list' | 'timeline';
  });
  // Always show expanded view - compact view removed entirely
  const [editMode, setEditMode] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('voyageListEditMode');
    return saved === 'true';
  });

  // Fetch voyages with React Query and pagination
  const { data, isLoading: loading } = useQuery({
    queryKey: ['voyages', params.toString(), page],
    queryFn: async () => {
      const searchParams = new URLSearchParams(params);
      searchParams.set("limit", pageSize.toString());
      searchParams.set("offset", ((page - 1) * pageSize).toString());
      const response = await api.listVoyages(searchParams);
      // Handle both old format (array) and new format (object with items and total)
      if (Array.isArray(response)) {
        return { items: response, total: response.length };
      }
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const voyages = data?.items || [];
  const totalCount = data?.total || 0;

  // Track which president/owner sections are collapsed
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const saved = sessionStorage.getItem('voyageListCollapsedSections');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Toggle section collapse
  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionName)) {
        newSet.delete(sectionName);
      } else {
        newSet.add(sectionName);
      }
      sessionStorage.setItem('voyageListCollapsedSections', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  const [moreOpen, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const presidentDropdownRef = useRef<HTMLDivElement>(null);

  // Boolean field filter options with human-readable labels
  const filterOptions = [
    { key: 'has_photo', label: 'Has Photos' },
    { key: 'has_video', label: 'Has Video' },
    { key: 'presidential_use', label: 'Presidential Use' },
    { key: 'has_royalty', label: 'Royalty Present' },
    { key: 'has_foreign_leader', label: 'Foreign Leader Present' },
    { key: 'mention_camp_david', label: 'Mentions Camp David' },
    { key: 'mention_mount_vernon', label: 'Mentions Mount Vernon' },
    { key: 'mention_captain', label: 'Mentions Captain' },
    { key: 'mention_crew', label: 'Mentions Crew' },
    { key: 'mention_rmd', label: 'Mentions Restoration, Maintenance, or Damage' },
    { key: 'mention_yacht_spin', label: 'Yacht Spin' },
    { key: 'mention_menu', label: 'Includes Menu Info' },
    { key: 'mention_drinks_wine', label: 'Mentions Drinks/Wine' },
  ];

  useEffect(() => {
    api
      .listPresidents()
      .then(presidents => {
        setPrez(presidents);
        // Initialize to all presidents selected if no saved filter
        const saved = sessionStorage.getItem('voyageListPresidentFilter');
        if (!saved) {
          const allSlugs = presidents.map(p => p.president_slug);
          setPres(allSlugs);
        }
        // Initialize all sections collapsed if no saved state
        const savedCollapsed = sessionStorage.getItem('voyageListCollapsedSections');
        if (!savedCollapsed) {
          const allSlugs = presidents.map(p => p.president_slug);
          setCollapsedSections(new Set(allSlugs));
        }
      })
      .catch(console.error);

    // Set default page if no params are present
    if (!params.toString()) {
      const p = new URLSearchParams();
      p.set("page", "1");
      setParams(p);
    }

    // Restore scroll position if returning from a voyage detail
    const savedScrollPosition = sessionStorage.getItem('voyageListScrollPosition');
    if (savedScrollPosition && scrollContainerRef.current) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
        sessionStorage.removeItem('voyageListScrollPosition');
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMore(false);
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [moreOpen]);

  useEffect(() => {
    if (!presidentDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (presidentDropdownRef.current && !presidentDropdownRef.current.contains(e.target as Node)) {
        setPresidentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [presidentDropdownOpen]);

  // Save president filter to sessionStorage
  useEffect(() => {
    if (pres.length > 0) {
      sessionStorage.setItem('voyageListPresidentFilter', JSON.stringify(pres));
    }
  }, [pres]);

  useEffect(() => {
    setQ(params.get("q") || "");
    setDF(params.get("date_from") || "");
    setDT(params.get("date_to") || "");
    setSig(params.get("significant") === "1");
    setRoy(params.get("royalty") === "1");
  }, [params]);

  // Sync page state with URL
  useEffect(() => {
    const pageParam = params.get("page");
    const newPage = pageParam ? parseInt(pageParam, 10) : 1;
    if (newPage !== page) {
      setPage(newPage);
    }
  }, [params]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sig) p.set("significant", "1");
    if (roy) p.set("royalty", "1");
    if (df) p.set("date_from", df);
    if (dt) p.set("date_to", dt);
    p.set("page", "1"); // Reset to first page on new search

    // Reset president filter to all when search query is applied
    if (q && presidents.length > 0) {
      const allSlugs = presidents.map(p => p.president_slug);
      setPres(allSlugs);
    }

    setParams(p);
    setPage(1);
    setMore(false);
  };
  const clear = () => {
    setQ(""); setDF(""); setDT("");
    const allSlugs = presidents.map(p => p.president_slug);
    setPres(allSlugs); // Reset to all selected
    setSig(false); setRoy(false);
    const p = new URLSearchParams();
    p.set("page", "1");
    setParams(p);
    setPage(1);
  };

  // Handle page navigation
  const goToPage = (newPage: number) => {
    const p = new URLSearchParams(params);
    p.set("page", newPage.toString());
    setParams(p);
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle saving edited voyage
  const handleVoyageSave = async (updatedVoyage: Voyage) => {
    try {
      // Call backend API to update voyage
      const response = await fetch(`/api/curator/voyages/${updatedVoyage.voyage_slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedVoyage),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Invalidate React Query cache to refetch data
      queryClient.invalidateQueries({ queryKey: ['voyages'] });

      console.log('Voyage saved successfully');
      alert('✓ Voyage saved successfully');
    } catch (error) {
      console.error('Error saving voyage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to save voyage: ${errorMessage}`);
    }
  };

  // Handle deleting voyage
  const handleVoyageDelete = async (voyageSlug: string) => {
    try {
      const response = await fetch(`/api/curator/voyages/${voyageSlug}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete voyage');
      }

      // Invalidate React Query cache to refetch data
      queryClient.invalidateQueries({ queryKey: ['voyages'] });
      alert('Voyage deleted successfully');
    } catch (error) {
      console.error('Error deleting voyage:', error);
      alert('Failed to delete voyage. Please try again.');
    }
  };

  // Handle creating new voyage - navigate to editor page
  const handleCreateNewVoyage = () => {
    navigate('/voyages/new');
  };

  // Filter voyages by selected boolean fields AND selected presidents
  const filteredVoyages = useMemo(() => {
    return voyages.filter(v => {
      // Filter by selected presidents
      if (pres.length > 0) {
        const voyagePresident = v.president_slug_from_voyage;
        if (!voyagePresident || !pres.includes(voyagePresident)) {
          return false;
        }
      }

      // Filter by boolean fields
      if (selectedFilters.size === 0) return true;
      // Voyage must match ALL selected filters (AND logic)
      return Array.from(selectedFilters).every(filterKey => {
        // Access the boolean field dynamically
        const value = v[filterKey as keyof Voyage];
        // Check if the field is true
        return value === true;
      });
    });
  }, [voyages, selectedFilters, pres]);

  // Group by presidency using denormalized field + map to name
  const presBySlug = new Map(presidents.map((p) => [p.president_slug, p.full_name]));
  const grouped = filteredVoyages.reduce<Record<string, Voyage[]>>((acc, v) => {
    const slug = v.president_slug_from_voyage || "non";
    const name = slug === "non" ? "Non-presidential" : (presBySlug.get(slug) || slug);
    (acc[name] ||= []).push(v);
    return acc;
  }, {});

  // Save scroll position before navigating away
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('voyageListScrollPosition', window.scrollY.toString());
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Save viewMode when it changes
  useEffect(() => {
    sessionStorage.setItem('voyageListViewMode', viewMode);
  }, [viewMode]);

  // Save editMode when it changes
  useEffect(() => {
    sessionStorage.setItem('voyageListEditMode', editMode.toString());
  }, [editMode]);

  // Save selected filters when they change
  useEffect(() => {
    sessionStorage.setItem('voyageListFilters', JSON.stringify(Array.from(selectedFilters)));
  }, [selectedFilters]);

  return (
    <Layout>
      <div ref={scrollContainerRef} className="px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
        {/* View Mode Toggle - Always visible */}
        <div className="mb-4 flex justify-end">
          <div className="flex rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm font-medium rounded-l-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-2 text-sm font-medium rounded-r-md border-l transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>

        {viewMode !== 'timeline' && (
          <form
          onSubmit={apply}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          className="flex flex-wrap items-end gap-4 mb-8 bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
        >
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span>From:</span>
          <input type="date" value={df} onChange={(e) => setDF(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span>To:</span>
          <input type="date" value={dt} onChange={(e) => setDT(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
        </label>

        <div ref={presidentDropdownRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vessel Owner:
          </label>
          <button
            type="button"
            onClick={() => setPresidentDropdownOpen(!presidentDropdownOpen)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent w-48 text-left flex items-center justify-between"
          >
            <span>
              {pres.length === 0
                ? 'None selected'
                : pres.length === presidents.length
                ? 'Owners/Presidents'
                : `${pres.length} selected`}
            </span>
            <span>▾</span>
          </button>

          {presidentDropdownOpen && (
            <div className="absolute z-20 mt-1 w-72 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 max-h-80 overflow-y-auto">
              <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900">Select Presidents/Owners</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPres(presidents.map(p => p.president_slug))}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setPres([])}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="p-2">
                {presidents.map(president => {
                  const isSelected = pres.includes(president.president_slug);
                  return (
                    <label
                      key={president.president_slug}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPres([...pres, president.president_slug]);
                          } else {
                            setPres(pres.filter(s => s !== president.president_slug));
                          }
                        }}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">
                        {president.full_name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {viewMode === 'list' && (
          <div ref={moreRef} className="relative">
            <button
              type="button"
              onClick={() => setMore((o) => !o)}
              className="text-sm px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 font-medium"
            >
              Filter Voyages {selectedFilters.size > 0 && `(${selectedFilters.size})`} ▾
            </button>

            {moreOpen && (
            <div className="absolute z-20 mt-2 w-72 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Voyage Attributes</span>
                  {selectedFilters.size > 0 && (
                    <button
                      onClick={() => setSelectedFilters(new Set())}
                      className="text-xs text-gray-600 hover:text-gray-900"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Show only voyages with all selected attributes</p>
              </div>
              <div className="p-2">
                {filterOptions.map(({ key, label }) => {
                  const isSelected = selectedFilters.has(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newFilters = new Set(selectedFilters);
                          if (e.target.checked) {
                            newFilters.add(key);
                          } else {
                            newFilters.delete(key);
                          }
                          setSelectedFilters(newFilters);
                        }}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Edit/Read mode toggle - only in list view */}
          <div className="flex rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                editMode
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Enable inline editing"
            >
              {editMode ? 'Editing' : 'Edit Mode'}
            </button>
          </div>

          {editMode && (
            <button
              type="button"
              onClick={handleCreateNewVoyage}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
              title="Create a new voyage"
            >
              + New Voyage
            </button>
          )}

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voyages..." className="px-3 py-2 border border-gray-300 rounded-md w-48 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
          <button type="submit" className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors">Apply Search</button>
          <button type="button" onClick={clear} className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-900 font-medium border border-gray-300 hover:border-gray-400 transition-colors">Clear</button>
        </div>
      </form>
        )}

      {loading && <p className="text-center text-gray-600 py-12">Loading voyages...</p>}
      {!loading && voyages.length === 0 && <p className="text-center text-gray-600 py-12">No voyages found.</p>}

      {!loading && filteredVoyages.length > 0 && (
        <>
          {viewMode !== 'timeline' && (
            <div className="mb-4 text-sm text-gray-700 font-medium">
              Showing {filteredVoyages.length} voyage{filteredVoyages.length === 1 ? '' : 's'}
            </div>
          )}
          {viewMode === 'timeline' ? (
            <HorizontalTimeline />
          ) : (
            <div className="timeline">
              {Object.entries(grouped)
                .sort(([, itemsA], [, itemsB]) => {
                  // Sort presidency groups by earliest voyage start_date
                  const earliestA = itemsA.filter(v => v.start_date).sort((a, b) =>
                    String(a.start_date).localeCompare(String(b.start_date))
                  )[0]?.start_date || '';
                  const earliestB = itemsB.filter(v => v.start_date).sort((a, b) =>
                    String(a.start_date).localeCompare(String(b.start_date))
                  )[0]?.start_date || '';
                  return String(earliestA).localeCompare(String(earliestB));
                })
                .map(([hdr, items]) => {
                  const isCollapsed = collapsedSections.has(hdr);
                  const displayName = hdr === "Non-presidential" ? "Before / After Presidential Service" : `${hdr} Administration`;

                  return (
                    <section key={hdr} className="mb-8">
                      <button
                        onClick={() => toggleSection(hdr)}
                        className="sticky top-0 z-10 w-full py-4 mb-6 text-lg font-semibold bg-white border-b border-gray-200 text-gray-900 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <span>{displayName} ({items.length})</span>
                        <span className="text-2xl transition-transform" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                          ▼
                        </span>
                      </button>

                      {!isCollapsed && items
                        .filter((v) => v.start_date)
                        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
                        .map((v) => (
                          <VoyageCardExpanded
                            key={v.voyage_slug}
                            voyage={v}
                            editMode={editMode}
                            onSave={handleVoyageSave}
                            onDelete={handleVoyageDelete}
                          />
                        ))}
                    </section>
                  );
                })}
            </div>
          )}

          {/* Pagination Controls */}
          {viewMode !== 'timeline' && !loading && filteredVoyages.length > 0 && (
            <div className="mt-8 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
              <div className="flex flex-1 flex-col gap-3 sm:hidden">
                <div className="text-sm text-gray-700 text-center">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
                </div>
                <div className="flex justify-between">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page === 1}
                    className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                      page === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700 self-center">
                    Page {page}
                  </span>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={filteredVoyages.length < pageSize}
                    className={`relative inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${
                      filteredVoyages.length < pageSize
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{((page - 1) * pageSize) + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(page * pageSize, totalCount)}</span> of{' '}
                    <span className="font-medium">{totalCount}</span> results
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 1}
                      className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                        page === 1 ? 'cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {/* Page numbers */}
                    {page > 2 && (
                      <button
                        onClick={() => goToPage(1)}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        1
                      </button>
                    )}
                    {page > 3 && (
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                        ...
                      </span>
                    )}
                    {page > 1 && (
                      <button
                        onClick={() => goToPage(page - 1)}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        {page - 1}
                      </button>
                    )}
                    <button
                      aria-current="page"
                      className="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20"
                    >
                      {page}
                    </button>
                    {filteredVoyages.length === pageSize && (
                      <button
                        onClick={() => goToPage(page + 1)}
                        className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        {page + 1}
                      </button>
                    )}
                    <button
                      onClick={() => goToPage(page + 1)}
                      disabled={filteredVoyages.length < pageSize}
                      className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 ${
                        filteredVoyages.length < pageSize ? 'cursor-not-allowed' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </Layout>
  );
}
