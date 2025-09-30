// src/components/VoyageDetail.tsx
import { api } from "../api";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MediaGallery from "./MediaGallery";
import { Voyage, Person, MediaItem } from "../types";

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
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [v, p, m] = await Promise.all([
          api.getVoyage(voyageSlug).catch(() => null),
          api.getVoyagePeople(voyageSlug).catch(() => []),
          api.getVoyageMedia(voyageSlug).catch(() => []),
        ]);
        if (!alive) return;
        setVoyage(v);
        setPeople(p);
        setMedia(m);
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

  // Separate media by type: Drive/Dropbox/S3 vs other sources
  const displayableMedia = media.filter(m => {
    const url = m.url || m.public_derivative_url || m.s3_url || m.google_drive_link || '';
    return url.includes('drive.google.com') ||
           url.includes('dropbox.com') ||
           url.includes('s3.amazonaws.com') ||
           url.includes('sequoia-');
  });

  const sourceLinks = media.filter(m => {
    const url = m.url || m.public_derivative_url || m.s3_url || m.google_drive_link || '';
    return url && !(
      url.includes('drive.google.com') ||
      url.includes('dropbox.com') ||
      url.includes('s3.amazonaws.com') ||
      url.includes('sequoia-')
    );
  });

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

      {/* Media Gallery - Only Drive/Dropbox/S3 */}
      {displayableMedia.length > 0 && (
        <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Media</h3>
          <MediaGallery voyageSlug={voyageSlug} filterDisplayable={true} />
        </section>
      )}

      {/* Sources - External links */}
      {sourceLinks.length > 0 && (
        <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Sources</h3>
          <div className="space-y-3">
            {sourceLinks.map((source) => (
              <div key={source.media_slug} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-sm">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      {source.title || source.credit || 'Source Document'}
                    </h4>
                    {source.description_markdown && (
                      <p className="text-xs text-gray-600 mb-2">{source.description_markdown}</p>
                    )}
                    {source.date && (
                      <p className="text-xs text-gray-500 mb-2">Date: {source.date}</p>
                    )}
                    <a
                      href={source.url || source.google_drive_link || source.s3_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      View Source →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
