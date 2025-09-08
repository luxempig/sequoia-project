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

  if (loading) return <div className="p-6">Loading administrations…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-blue-600 hover:underline">← Back</Link>
      <h1 className="mt-3 text-2xl font-bold">Presidential Administrations</h1>
      <p className="text-gray-600 mb-6">Browse voyages by ownership period.</p>

      <div className="divide-y divide-gray-200 bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
        {rows.map((p) => (
          <Link
            key={p.president_slug}
            to={`/presidents/${p.president_slug}`}
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div>
              <div className="font-semibold">{p.full_name}</div>
              <div className="text-sm text-gray-600">
                {fmtRange(p.term_start, p.term_end)}
              </div>
              {p.party && <div className="text-xs text-gray-500 mt-1">{p.party}</div>}
            </div>
            <div className="text-sm text-gray-700">
              {counts[p.president_slug] ?? 0} voyages →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
