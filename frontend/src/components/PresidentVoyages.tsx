import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api";
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

export default function PresidentVoyages() {
  const { slug } = useParams<{ slug: string }>();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [presName, setPresName] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [plist, vs] = await Promise.all([
          api.listPresidents(),
          slug ? api.voyagesByPresident(slug) : Promise.resolve([]),
        ]);
        if (!alive) return;
        setVoyages(vs || []);
        const p = plist.find((x: President) => x.president_slug === slug);
        setPresName(p?.full_name || "");
      } catch {
        if (!alive) return;
        setVoyages([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <Link to="/presidents" className="text-blue-600 hover:underline">← All administrations</Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">{presName || "Administration"}</h1>
      <p className="text-gray-600 mb-6">Voyages during this ownership period.</p>

      {voyages.length === 0 ? (
        <div className="text-gray-600">No voyages found.</div>
      ) : (
        <div className="space-y-3">
          {voyages
            .filter((v) => v.start_date)
            .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))
            .map((v) => (
              <Link
                key={v.voyage_slug}
                to={`/voyages/${v.voyage_slug}`}
                className="block bg-white p-4 rounded-xl shadow-sm ring-1 ring-gray-200 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">
                    {dayjs(v.start_date!).format("MMM D, YYYY")}
                    {v.end_date && " – " + dayjs(v.end_date).format("MMM D, YYYY")}
                  </div>
                  <div className="flex gap-2">
                    {(v.significant === 1 || v.significant === true) && <Badge>Significant</Badge>}
                    {(v.royalty === 1 || v.royalty === true) && <Badge tone="violet">Royalty</Badge>}
                  </div>
                </div>
                {v.summary_markdown && (
                  <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {v.summary_markdown}
                  </div>
                )}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
