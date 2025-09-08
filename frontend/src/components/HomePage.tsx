// src/components/HomePage.tsx
import { api } from "../api";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { President } from "../types";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [significant, setSig] = useState(false);
  const [royalty, setRoy] = useState(false);
  const [presidentSlug, setPres] = useState("");
  const [presidents, setList] = useState<President[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await api.listPresidents();
        if (!alive) return;
        setList(list);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [moreOpen]);

  const qs = () => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (significant) p.set("significant", "1");
    if (royalty) p.set("royalty", "1");
    if (presidentSlug) p.set("president_slug", presidentSlug);
    return p.toString();
  };
  const goSearch = () => navigate(`/voyages${qs() ? "?" + qs() : ""}`);
  const goFullTimeline = () => navigate("/voyages");

  const Badge: React.FC<{ tone?: "amber" | "violet"; children: React.ReactNode }> = ({
    tone = "amber",
    children,
  }) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md ring-1
      ${
        tone === "amber"
          ? "bg-amber-100 text-amber-800 ring-amber-200"
          : "bg-violet-100 text-violet-800 ring-violet-200"
      }`}
    >
      {children}
    </span>
  );

  const glass = "bg-white/20 backdrop-blur-md ring-1 ring-white/30 shadow-lg";

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <section className="relative flex-grow">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/sequoia-homepage.jpeg)" }}
        />
        <div className="absolute inset-0 bg-indigo-900/60" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 sm:p-8 text-center text-white">
          <h1 className="text-5xl sm:text-7xl font-extrabold mb-4 tracking-tight leading-tight">
            HI ISABEL :DDDD
          </h1>
          <p className="text-lg mb-10 text-indigo-200">
            Charting a century of presidential voyages
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              goSearch();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                goSearch();
              }
            }}
            className={`w-full max-w-xl ${glass} rounded-2xl p-6 sm:p-8 space-y-6`}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any keyword to find associated voyages…"
              className="w-full p-3 rounded-lg bg-white/70 text-gray-900 placeholder-gray-500 focus:outline-none"
            />

            <select
              value={presidentSlug}
              onChange={(e) => setPres(e.target.value)}
              className="w-full p-3 rounded-lg bg-white/70 text-gray-900"
            >
              <option value="">All administrations</option>
              {presidents.map((p) => (
                <option key={p.president_slug} value={p.president_slug}>
                  {p.full_name}
                </option>
              ))}
            </select>

            <div className="relative mx-auto" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                className="text-sm px-3 py-1.5 border rounded bg-white/90 text-gray-800 hover:bg-white"
              >
                More filters ▾
              </button>

              {!moreOpen && (
                <span className="ml-2 inline-flex gap-1">
                  {significant && <Badge>Significant</Badge>}
                  {royalty && <Badge tone="violet">Royalty</Badge>}
                </span>
              )}

              {moreOpen && (
                <div className="absolute z-20 mt-2 w-56 left-1/2 -translate-x-1/2 bg-white text-gray-800 rounded-lg shadow-lg ring-1 ring-gray-200 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={significant}
                      onChange={(e) => setSig(e.target.checked)}
                    />
                    <span>Significant Voyage</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={royalty}
                      onChange={(e) => setRoy(e.target.checked)}
                    />
                    <span>Royalty Aboard</span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button
                type="submit"
                className="px-6 py-3 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 font-medium transition hover:scale-105"
              >
                Search
              </button>
              <button
                type="button"
                onClick={goFullTimeline}
                className="px-6 py-3 rounded-lg bg-white/30 hover:bg-white/40 font-medium transition hover:scale-105"
              >
                Full timeline
              </button>
            </div>
          </form>

          <a href="#about" className="mt-12 text-indigo-200 hover:text-white transition">
            Learn more ↓
          </a>
        </div>
      </section>

      {/* (rest unchanged) */}
      {/* ... keep your long-form sections exactly as before ... */}
    </div>
  );
}
