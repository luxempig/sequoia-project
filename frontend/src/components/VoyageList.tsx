import { api } from "../api";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

  const [q, setQ] = useState(() => params.get("q") || "");
  const [df, setDF] = useState(() => params.get("date_from") || "");
  const [dt, setDT] = useState(() => params.get("date_to") || "");
  const [pres, setPres] = useState(() => params.get("president_slug") || "");
  const [sig, setSig] = useState(params.get("significant") === "1");
  const [roy, setRoy] = useState(params.get("royalty") === "1");
  // Boolean field filters
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());

  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [presidents, setPrez] = useState<President[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>(() => {
    const saved = sessionStorage.getItem('voyageListViewMode');
    return (saved === 'timeline' ? 'timeline' : 'list') as 'list' | 'timeline';
  });
  // Always show expanded view - compact view removed entirely
  const [editMode, setEditMode] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('voyageListEditMode');
    return saved === 'true';
  });

  const [moreOpen, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    { key: 'mention_rmd', label: 'Mentions RMD' },
    { key: 'mention_yacht_spin', label: 'Yacht Spin' },
    { key: 'mention_menu', label: 'Includes Menu Info' },
    { key: 'mention_drinks_wine', label: 'Mentions Drinks/Wine' },
  ];

  useEffect(() => {
    api
      .listPresidents()
      .then(setPrez)
      .catch(console.error);

    // Set default limit if no params are present
    if (!params.toString()) {
      const p = new URLSearchParams();
      p.set("limit", "1000");
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
    setQ(params.get("q") || "");
    setDF(params.get("date_from") || "");
    setDT(params.get("date_to") || "");
    setPres(params.get("president_slug") || "");
    setSig(params.get("significant") === "1");
    setRoy(params.get("royalty") === "1");
  }, [params]);

  useEffect(() => {
    setLoading(true);
    api
      .listVoyages(params)
      .then((d) => setVoyages(Array.isArray(d) ? d : []))
      .catch(() => setVoyages([]))
      .finally(() => setLoading(false));
  }, [params]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sig) p.set("significant", "1");
    if (roy) p.set("royalty", "1");
    if (df) p.set("date_from", df);
    if (dt) p.set("date_to", dt);
    if (pres) p.set("president_slug", pres);
    p.set("limit", "1000"); // Fetch all voyages
    setParams(p);
    setMore(false);
  };
  const clear = () => {
    setQ(""); setDF(""); setDT(""); setPres(""); setSig(false); setRoy(false);
    const p = new URLSearchParams();
    p.set("limit", "1000");
    setParams(p);
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

      // Update local state
      setVoyages(prevVoyages =>
        prevVoyages.map(v =>
          v.voyage_slug === updatedVoyage.voyage_slug ? updatedVoyage : v
        )
      );

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

      // Remove from local state
      setVoyages(prevVoyages => prevVoyages.filter(v => v.voyage_slug !== voyageSlug));
      alert('Voyage deleted successfully');
    } catch (error) {
      console.error('Error deleting voyage:', error);
      alert('Failed to delete voyage. Please try again.');
    }
  };

  // Handle creating new voyage
  const handleCreateNewVoyage = async () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const newVoyage = {
      // voyage_slug will be auto-generated by backend
      title: '',
      start_date: today,
      end_date: today,
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

    try {
      const response = await fetch('/api/curator/voyages/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newVoyage)
      });

      if (!response.ok) {
        throw new Error('Failed to create voyage');
      }

      const createdVoyage = await response.json();
      alert(`Voyage "${createdVoyage.voyage_slug}" created successfully with auto-generated ID!`);

      // Add to local state
      setVoyages(prevVoyages => [...prevVoyages, createdVoyage]);
    } catch (error) {
      console.error('Error creating voyage:', error);
      alert('Failed to create voyage. Please try again.');
    }
  };

  // Filter voyages by selected boolean fields
  const filteredVoyages = useMemo(() => {
    if (selectedFilters.size === 0) return voyages;
    return voyages.filter(v => {
      // Voyage must match ALL selected filters (AND logic)
      return Array.from(selectedFilters).every(filterKey => {
        // Access the boolean field dynamically
        const value = v[filterKey as keyof Voyage];
        // Check if the field is true
        return value === true;
      });
    });
  }, [voyages, selectedFilters]);

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

  // Restore selected filters on mount
  useEffect(() => {
    const savedFilters = sessionStorage.getItem('voyageListFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setSelectedFilters(new Set(filters));
      } catch (e) {
        console.error('Failed to restore filters:', e);
      }
    }
  }, []);

  return (
    <Layout>
      <div ref={scrollContainerRef} className="px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
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

        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span>Vessel Owner:</span>
          <select value={pres} onChange={(e) => setPres(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent">
            <option value="">All Owners/Presidents</option>
            {presidents
              .filter((p) => !['reagan-ronald', 'bush-george-w', 'obama-barack', 'post-presidential'].includes(p.president_slug))
              .map((p) => (
                <option key={p.president_slug} value={p.president_slug}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>

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

          {viewMode === 'list' && (
            <>
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
              <button type="submit" className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors">Apply Filters</button>
              <button type="button" onClick={clear} className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-900 font-medium border border-gray-300 hover:border-gray-400 transition-colors">Clear</button>
            </>
          )}
        </div>
      </form>

      {loading && <p className="text-center text-gray-600 py-12">Loading voyages...</p>}
      {!loading && voyages.length === 0 && <p className="text-center text-gray-600 py-12">No voyages found.</p>}

      {!loading && filteredVoyages.length > 0 && (
        <>
          <div className="mb-4 text-sm text-gray-700 font-medium">
            Showing {filteredVoyages.length} voyage{filteredVoyages.length === 1 ? '' : 's'}
          </div>
          {viewMode === 'timeline' ? (
            <HorizontalTimeline voyages={filteredVoyages} />
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
                .map(([hdr, items]) => (
                <section key={hdr} className="mb-8">
                  <h2 className="sticky top-0 z-10 py-4 mb-6 text-lg font-semibold bg-white border-b border-gray-200 text-gray-900">
                    {hdr === "Non-presidential" ? "Before / After Presidential Service" : `${hdr} Administration`}
                  </h2>

                  {items
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
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </Layout>
  );
}
