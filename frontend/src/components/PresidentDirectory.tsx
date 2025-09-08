import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api";
import { President } from "../types";

const fmtRange = (s: string, e: string | null) => {
  const A = dayjs(s);
  const B = e ? dayjs(e) : null;
  return `${A.format("MMM D, YYYY")} – ${B ? B.format("MMM D, YYYY") : "Present"}`;
};

export default function PresidentDirectory() {
  const [pres, setPres] = useState<President[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.listPresidents();
        if (!alive) return;
        setPres(data);
        const entries = await Promise.all(
          data.map(async (p) => {
            try {
              const vs = await api.listVoyages(
                new URLSearchParams({ president_slug: p.president_slug })
              );
              return [p.president_slug, vs.length] as const;
            } catch {
              return [p.president_slug, 0] as const;
            }
          })
        );
        if (!alive) return;
        setCounts(Object.fromEntries(entries));
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(
    () => pres.slice().sort((a, b) => a.term_start.localeCompare(b.term_start)),
    [pres]
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading administrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-gray-600 hover:text-gray-900 inline-block mb-8 font-medium">← Home</Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Presidents</h1>
      <p className="text-gray-500 mb-6">Browse voyages by presidential administration.</p>

      <div className="divide-y divide-gray-200 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {rows.map((p) => (
          <Link
            key={p.president_slug}
            to={`/presidents/${p.president_slug}`}
            className="flex items-center justify-between p-6 hover:bg-gray-50"
          >
            <div>
              <div className="font-medium text-gray-900">{p.full_name}</div>
              <div className="text-sm text-gray-500">
                {fmtRange(p.term_start, p.term_end)}
              </div>
              {p.party && <div className="text-xs text-gray-400 mt-1">{p.party}</div>}
            </div>
            <div className="text-sm text-gray-500 font-medium">
              {counts[p.president_slug] ?? 0} voyages →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
