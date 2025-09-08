// src/components/VoyageDetail.tsx
import { api } from "../api";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MediaGallery from "./MediaGallery";
import { Voyage, Person } from "../types";

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
};

export default function VoyageDetail() {
  const { slug } = useParams<{ slug: string }>();
  const voyageSlug = slug!;
  const navigate = useNavigate();

  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [v, p] = await Promise.all([
          api.getVoyage(voyageSlug).catch(() => null),
          api.getVoyagePeople(voyageSlug).catch(() => []),
        ]);
        if (!alive) return;
        setVoyage(v);
        setPeople(p);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [voyageSlug]);

  if (loading) return <p className="p-4">Loading…</p>;
  if (!voyage) return <p className="p-4">Voyage not found</p>;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-8">
      <button
        onClick={() => navigate(-1)}
        className="text-blue-600 hover:underline"
      >
        ← Back to timeline
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">
            {voyage.title || `Voyage ${voyage.voyage_slug}`}
          </h1>
          <div className="text-sm sm:text-base text-gray-700">
            <strong>From</strong> {formatDate(voyage.start_date)}{" "}
            <strong>to</strong> {formatDate(voyage.end_date)}
          </div>
        </div>

        {voyage.summary_markdown && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold mb-1">Summary</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {voyage.summary_markdown}
            </p>
          </div>
        )}
      </div>

      {/* Media */}
      <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Media</h3>
        <MediaGallery voyageSlug={voyageSlug} />
      </section>

      {/* People */}
      <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">People</h3>
        {people.length === 0 ? (
          <p className="text-gray-600">No people recorded for this voyage.</p>
        ) : (
          <ul className="space-y-2">
            {people.map((p) => (
              <li key={p.person_slug} className="flex items-start gap-2">
                <span className="mt-1">•</span>
                <div className="text-sm">
                  <div className="font-medium">{p.full_name}</div>
                  {p.role_title && (
                    <div className="text-gray-700">{p.role_title}</div>
                  )}
                  {p.capacity_role && (
                    <div className="text-gray-700">Role: {p.capacity_role}</div>
                  )}
                  {p.voyage_notes && (
                    <div className="text-gray-700">{p.voyage_notes}</div>
                  )}
                  {p.wikipedia_url && (
                    <a
                      href={p.wikipedia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Wikipedia
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
