import { api } from "../api";
import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import VoyageCard from "./VoyageCard";
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

export default function VoyageList() {
  const [params, setParams] = useSearchParams();

  const [q, setQ] = useState(() => params.get("q") || "");
  const [df, setDF] = useState(() => params.get("date_from") || "");
  const [dt, setDT] = useState(() => params.get("date_to") || "");
  const [pres, setPres] = useState(() => params.get("president_slug") || "");
  const [sig, setSig] = useState(params.get("significant") === "1");
  const [roy, setRoy] = useState(params.get("royalty") === "1");

  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [presidents, setPrez] = useState<President[]>([]);
  const [loading, setLoading] = useState(true);

  const [moreOpen, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

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

  // Group by presidency using denormalized field + map to name
  const presBySlug = new Map(presidents.map((p) => [p.president_slug, p.full_name]));
  const grouped = voyages.reduce<Record<string, Voyage[]>>((acc, v) => {
    const slug = v.president_slug_from_voyage || "non";
    const name = slug === "non" ? "Non-presidential" : (presBySlug.get(slug) || slug);
    (acc[name] ||= []).push(v);
    return acc;
  }, {});

  return (
    <div className="px-6 lg:px-8 py-8">
      <Link to="/" className="text-amber-800 hover:text-amber-600 inline-block mb-8 font-light tracking-wide">
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
        className="flex flex-wrap items-end gap-4 mb-8 bg-white/60 p-6 rounded-sm border border-amber-200/30 shadow-sm backdrop-blur-sm"
      >
        <label className="flex items-center gap-2 text-sm font-light text-amber-900 tracking-wide">
          <span>From:</span>
          <input type="date" value={df} onChange={(e) => setDF(e.target.value)} className="px-3 py-2 border border-amber-300/40 rounded-sm bg-white text-amber-900 font-light focus:outline-none focus:border-amber-600" />
        </label>
        <label className="flex items-center gap-2 text-sm font-light text-amber-900 tracking-wide">
          <span>To:</span>
          <input type="date" value={dt} onChange={(e) => setDT(e.target.value)} className="px-3 py-2 border border-amber-300/40 rounded-sm bg-white text-amber-900 font-light focus:outline-none focus:border-amber-600" />
        </label>

        <label className="flex items-center gap-2 text-sm font-light text-amber-900 tracking-wide">
          <span>President:</span>
          <select value={pres} onChange={(e) => setPres(e.target.value)} className="px-3 py-2 border border-amber-300/40 rounded-sm bg-white text-amber-900 font-light focus:outline-none focus:border-amber-600">
            <option value="">All Administrations</option>
            {presidents.map((p) => (
              <option key={p.president_slug} value={p.president_slug}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>

        <div ref={moreRef} className="relative">
          <button
            type="button"
            onClick={() => setMore((o) => !o)}
            className="text-sm px-3 py-1.5 border-2 border-amber-300/60 rounded-md bg-white/80 text-amber-900 hover:bg-white font-serif font-semibold"
          >
            More filters ▾
          </button>
          {!moreOpen && (
            <span className="ml-2 inline-flex gap-1">
              {sig && <Badge>Significant</Badge>}
              {roy && <Badge tone="violet">Royalty</Badge>}
            </span>
          )}

          {moreOpen && (
            <div className="absolute z-20 mt-2 w-56 bg-amber-50/95 text-amber-900 rounded-lg shadow-xl ring-2 ring-amber-200/60 p-4 space-y-3 backdrop-blur-sm">
              <label className="flex items-center gap-2 text-sm font-serif font-semibold">
                <input type="checkbox" checked={sig} onChange={(e) => setSig(e.target.checked)} />
                <span>Significant Voyage</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-serif font-semibold">
                <input type="checkbox" checked={roy} onChange={(e) => setRoy(e.target.checked)} />
                <span>Royalty Aboard</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voyages..." className="px-3 py-2 border border-amber-300/40 rounded-sm w-48 bg-white text-amber-900 placeholder-amber-700/40 font-light focus:outline-none focus:border-amber-600" />
          <button type="submit" className="px-4 py-2 rounded-sm bg-amber-800 text-white hover:bg-amber-700 font-light tracking-wide transition-colors">Search</button>
          <button type="button" onClick={clear} className="px-4 py-2 rounded-sm bg-white hover:bg-stone-50 text-amber-900 font-light tracking-wide border border-amber-300/40 hover:border-amber-400/40 transition-colors">Clear</button>
        </div>
      </form>

      {loading && <p className="text-center text-amber-800/70 py-12 font-light tracking-wide">Loading voyages...</p>}
      {!loading && voyages.length === 0 && <p className="text-center text-amber-800/70 py-12 font-light tracking-wide">No voyages found.</p>}

      {!loading && voyages.length > 0 && (
        <div className="timeline">
          {Object.entries(grouped).map(([hdr, items]) => (
            <section key={hdr} className="mb-8">
              <h2 className="sticky top-0 z-10 py-3 mb-6 text-lg font-medium bg-white/80 backdrop-blur border-b border-amber-200/30 text-amber-900 tracking-wide">
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
    </div>
  );
}
