// src/components/HomePage.tsx - HTTPS setup
import { api } from "../api";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { President } from "../types";
import Layout from "./Layout";

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

  const Badge: React.FC<{
    tone?: "amber" | "violet";
    children: React.ReactNode;
  }> = ({ tone = "amber", children }) => (
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
    <Layout>
    <div className="min-h-screen flex flex-col overflow-x-hidden -mt-16">
      <section className="relative flex-grow">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/sequoia-homepage.jpeg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/60 via-amber-800/70 to-slate-900/80" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full p-6 sm:p-8 text-center">
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-b from-amber-400 via-amber-500 to-amber-700 rounded-full flex items-center justify-center border-6 border-amber-200 shadow-2xl mb-6">
              <span className="text-4xl text-amber-50">⚓</span>
            </div>
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold mb-4 tracking-tight leading-tight font-serif text-amber-50 drop-shadow-2xl">
            USS Sequoia Archive
          </h1>
          <p className="text-xl mb-4 text-amber-100 font-serif italic drop-shadow-lg">
            Presidential Maritime Collection
          </p>
          <p className="text-lg mb-10 text-amber-200/90 font-serif max-w-2xl">
            Charting a century of presidential voyages aboard America's most distinguished yacht
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
                className="px-6 py-3 rounded-lg bg-amber-700/80 hover:bg-amber-600 font-medium font-serif transition hover:scale-105 text-amber-50 border-2 border-amber-500/50 hover:border-amber-400 shadow-lg"
              >
                Chart Course
              </button>
              <button
                type="button"
                onClick={goFullTimeline}
                className="px-6 py-3 rounded-lg bg-amber-800/60 hover:bg-amber-700/80 font-medium font-serif transition hover:scale-105 text-amber-100 border-2 border-amber-600/50 hover:border-amber-500 shadow-lg"
              >
                Full Maritime Log
              </button>
            </div>
          </form>

          <a
            href="#about"
            className="mt-12 text-amber-200 hover:text-amber-50 transition font-serif"
          >
            Learn more ↓
          </a>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 bg-gradient-to-b from-amber-50 to-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-amber-900 sm:text-4xl font-serif">
              About the USS Sequoia Archive
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-amber-800 font-serif italic">
              A comprehensive digital collection of presidential voyages aboard America's most distinguished yacht
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-center p-6 bg-white/60 rounded-lg shadow-lg border border-amber-200/50">
              <div className="flex items-center justify-center h-16 w-16 mx-auto bg-gradient-to-b from-amber-600 to-amber-700 text-amber-50 rounded-full border-3 border-amber-300 shadow-lg">
                🚢
              </div>
              <h3 className="mt-6 text-lg font-bold text-amber-900 font-serif">Presidential Voyages</h3>
              <p className="mt-2 text-base text-amber-800 font-serif">
                Detailed records of presidential trips and official state visits aboard the USS Sequoia
              </p>
            </div>
            <div className="text-center p-6 bg-white/60 rounded-lg shadow-lg border border-amber-200/50">
              <div className="flex items-center justify-center h-16 w-16 mx-auto bg-gradient-to-b from-amber-600 to-amber-700 text-amber-50 rounded-full border-3 border-amber-300 shadow-lg">
                📸
              </div>
              <h3 className="mt-6 text-lg font-bold text-amber-900 font-serif">Historical Media</h3>
              <p className="mt-2 text-base text-amber-800 font-serif">
                Photographs, documents, and multimedia from decades of presidential history
              </p>
            </div>
            <div className="text-center p-6 bg-white/60 rounded-lg shadow-lg border border-amber-200/50">
              <div className="flex items-center justify-center h-16 w-16 mx-auto bg-gradient-to-b from-amber-600 to-amber-700 text-amber-50 rounded-full border-3 border-amber-300 shadow-lg">
                👥
              </div>
              <h3 className="mt-6 text-lg font-bold text-amber-900 font-serif">People & Passengers</h3>
              <p className="mt-2 text-base text-amber-800 font-serif">
                Comprehensive directory of passengers, crew, and officials who traveled aboard
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
    </Layout>
  );
}
