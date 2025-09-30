import { api } from "../api";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import VoyageCard from "./VoyageCard";
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
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [presidents, setPrez] = useState<President[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const [moreOpen, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Extract all distinct tags from voyages
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    voyages.forEach(v => {
      if (v.tags) {
        // Try to parse as JSON array first
        try {
          const parsed = JSON.parse(v.tags);
          if (Array.isArray(parsed)) {
            parsed.forEach(tag => {
              const trimmed = String(tag).trim();
              if (trimmed) tagSet.add(trimmed);
            });
            return;
          }
        } catch {
          // Not JSON, continue with comma-separated parsing
        }

        // Fallback to comma-separated parsing
        v.tags.split(',').forEach(tag => {
          const trimmed = tag.trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [voyages]);

  useEffect(() => {
    api
      .listPresidents()
      .then(setPrez)
      .catch(console.error);
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

  // Auto-apply filters when date or owner changes
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sig) p.set("significant", "1");
    if (roy) p.set("royalty", "1");
    if (df) p.set("date_from", df);
    if (dt) p.set("date_to", dt);
    if (pres) p.set("president_slug", pres);
    p.set("limit", "500"); // Fetch all voyages
    setParams(p);
  }, [df, dt, pres, q, sig, roy]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sig) p.set("significant", "1");
    if (roy) p.set("royalty", "1");
    if (df) p.set("date_from", df);
    if (dt) p.set("date_to", dt);
    if (pres) p.set("president_slug", pres);
    setParams(p);
    setMore(false);
  };
  const clear = () => {
    setQ(""); setDF(""); setDT(""); setPres(""); setSig(false); setRoy(false);
    setParams(new URLSearchParams());
  };

  // Filter voyages by selected tags
  const filteredVoyages = useMemo(() => {
    if (selectedTags.size === 0) return voyages;
    return voyages.filter(v => {
      if (!v.tags) return false;

      let voyageTags: string[] = [];

      // Try to parse as JSON array first
      try {
        const parsed = JSON.parse(v.tags);
        if (Array.isArray(parsed)) {
          voyageTags = parsed.map(t => String(t).trim());
        }
      } catch {
        // Fallback to comma-separated parsing
        voyageTags = v.tags.split(',').map(t => t.trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, ''));
      }

      return Array.from(selectedTags).some(tag => voyageTags.includes(tag));
    });
  }, [voyages, selectedTags]);

  // Group by presidency using denormalized field + map to name
  const presBySlug = new Map(presidents.map((p) => [p.president_slug, p.full_name]));
  const grouped = filteredVoyages.reduce<Record<string, Voyage[]>>((acc, v) => {
    const slug = v.president_slug_from_voyage || "non";
    const name = slug === "non" ? "Non-presidential" : (presBySlug.get(slug) || slug);
    (acc[name] ||= []).push(v);
    return acc;
  }, {});

  return (
    <div className="px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
      <Link to="/" className="text-gray-600 hover:text-gray-900 inline-block mb-8 font-medium">
        ← Home
      </Link>

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
              Filter by Tags {selectedTags.size > 0 && `(${selectedTags.size})`} ▾
            </button>

            {moreOpen && (
            <div className="absolute z-20 mt-2 w-64 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Voyage Tags</span>
                  {selectedTags.size > 0 && (
                    <button
                      onClick={() => setSelectedTags(new Set())}
                      className="text-xs text-gray-600 hover:text-gray-900"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              <div className="p-2">
                {allTags.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">No tags available</p>
                ) : (
                  allTags.map(tag => {
                    const color = getTagColor(tag);
                    const isSelected = selectedTags.has(tag);
                    return (
                      <label
                        key={tag}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newTags = new Set(selectedTags);
                            if (e.target.checked) {
                              newTags.add(tag);
                            } else {
                              newTags.delete(tag);
                            }
                            setSelectedTags(newTags);
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${color.bg} ${color.text} ${color.border}`}>
                          {tag}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voyages..." className="px-3 py-2 border border-gray-300 rounded-md w-48 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
          <button type="submit" className="px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 font-medium transition-colors">Search</button>
          <button type="button" onClick={clear} className="px-4 py-2 rounded-md bg-white hover:bg-gray-50 text-gray-900 font-medium border border-gray-300 hover:border-gray-400 transition-colors">Clear</button>
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
              {Object.entries(grouped).map(([hdr, items]) => (
                <section key={hdr} className="mb-8">
                  <h2 className="sticky top-0 z-10 py-4 mb-6 text-lg font-semibold bg-white border-b border-gray-200 text-gray-900">
                    {hdr === "Non-presidential" ? "Before / After Presidential Service" : `${hdr} Administration`}
                  </h2>

                  {items
                    .filter((v) => v.start_date)
                    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
                    .map((v) => (
                      <VoyageCard key={v.voyage_slug} voyage={v} />
                    ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
