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

const formatDateTime = (timestamp: string | null | undefined) => {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return timestamp;
  }
};

const stripMarkdown = (text: string | null | undefined) => {
  if (!text) return '';
  return text
    .replace(/^#+\s*/gm, '')   // Remove heading markers (##, ###, etc)
    .replace(/\*\*/g, '')       // Remove bold markers
    .replace(/\*/g, '')         // Remove italic markers
    .replace(/^[-*+]\s/gm, '')  // Remove list markers
    .replace(/^\d+\.\s/gm, '')  // Remove numbered list markers
    .replace(/`/g, '')          // Remove code markers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove links but keep text
};

export default function VoyageDetail() {
  const { slug } = useParams<{ slug: string }>();
  const voyageSlug = slug!;
  const navigate = useNavigate();

  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [adjacentVoyages, setAdjacentVoyages] = useState<{ previous: Voyage | null; next: Voyage | null }>({ previous: null, next: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [v, p, m, adj] = await Promise.all([
          api.getVoyage(voyageSlug).catch(() => null),
          api.getVoyagePeople(voyageSlug).catch(() => []),
          api.getVoyageMedia(voyageSlug).catch(() => []),
          api.getAdjacentVoyages(voyageSlug).catch(() => ({ previous: null, next: null })),
        ]);
        if (!alive) return;
        setVoyage(v);
        setPeople(p);
        setMedia(m);
        setAdjacentVoyages(adj);
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

  // Filter media by category
  const generalMedia = media.filter(m => {
    const category = m.media_category || 'general';
    return category === 'general' || !m.media_category;
  });

  const sourceMedia = media.filter(m => {
    return m.media_category === 'source';
  });

  const additionalSourceMedia = media.filter(m => {
    return m.media_category === 'additional_source';
  });

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:underline"
          >
            ← Back to timeline
          </button>
          <button
            onClick={() => navigate(`/voyages/${voyageSlug}/edit`)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            ✏️ Edit Voyage
          </button>
        </div>

        {/* Voyage Navigation */}
        <div className="flex gap-2">
          {adjacentVoyages.previous && (
            <button
              onClick={() => navigate(`/voyages/${adjacentVoyages.previous!.voyage_slug}`)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              title={adjacentVoyages.previous.title || adjacentVoyages.previous.voyage_slug}
            >
              ← Previous
            </button>
          )}
          {adjacentVoyages.next && (
            <button
              onClick={() => navigate(`/voyages/${adjacentVoyages.next!.voyage_slug}`)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              title={adjacentVoyages.next.title || adjacentVoyages.next.voyage_slug}
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">
            {voyage.title || `Voyage ${voyage.voyage_slug}`}
          </h1>
        </div>

        {/* Type Information */}
        {voyage.voyage_type && (
          <div className="mt-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 font-medium capitalize text-sm">
              {voyage.voyage_type}
            </span>
          </div>
        )}

        {/* Date and Time Information */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {/* Start Date/Time */}
          <div>
            <strong className="text-gray-900">Start:</strong>
            <div className="text-gray-700">
              {formatDateTime(voyage.start_timestamp) || formatDate(voyage.start_date)}
            </div>
            {(voyage.start_location || voyage.origin) && (
              <div className="text-gray-600 text-xs mt-1">
                {voyage.start_location || voyage.origin}
              </div>
            )}
          </div>

          {/* End Date/Time */}
          <div>
            <strong className="text-gray-900">End:</strong>
            <div className="text-gray-700">
              {formatDateTime(voyage.end_timestamp) || formatDate(voyage.end_date)}
            </div>
            {(voyage.end_location || voyage.destination) && (
              <div className="text-gray-600 text-xs mt-1">
                {voyage.end_location || voyage.destination}
              </div>
            )}
          </div>
        </div>

        {/* Boolean Metadata Tags */}
        {(voyage.has_photo || voyage.has_video || voyage.presidential_use || voyage.has_royalty ||
          voyage.has_foreign_leader || voyage.mention_camp_david || voyage.mention_mount_vernon ||
          voyage.mention_captain || voyage.mention_crew || voyage.mention_rmd || voyage.mention_yacht_spin ||
          voyage.mention_menu || voyage.mention_drinks_wine) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Voyage Attributes</h4>
            <div className="flex flex-wrap gap-2">
              {voyage.has_photo && <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">(Photo(s))</span>}
              {voyage.has_video && <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md">(Video(s))</span>}
              {voyage.presidential_use && voyage.presidential_initials && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md">({voyage.presidential_initials})</span>}
              {voyage.has_royalty && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-md">(Royalty{voyage.royalty_details ? `: ${voyage.royalty_details}` : ''})</span>}
              {voyage.has_foreign_leader && <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-md">(Foreign Leader{voyage.foreign_leader_country ? ` - ${voyage.foreign_leader_country}` : ''})</span>}
              {voyage.mention_camp_david && <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-md">(CD)</span>}
              {voyage.mention_mount_vernon && <span className="px-2 py-1 bg-pink-100 text-pink-800 text-xs rounded-md">(MV)</span>}
              {voyage.mention_captain && <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-md">(Captain)</span>}
              {voyage.mention_crew && <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-md">(Crew)</span>}
              {voyage.mention_rmd && <span className="px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-md">(RMD)</span>}
              {voyage.mention_yacht_spin && <span className="px-2 py-1 bg-lime-100 text-lime-800 text-xs rounded-md">(Yacht Spin)</span>}
              {voyage.mention_menu && <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md">(Menu)</span>}
              {voyage.mention_drinks_wine && <span className="px-2 py-1 bg-rose-100 text-rose-800 text-xs rounded-md">(Drinks/Wine)</span>}
            </div>
          </div>
        )}

        {voyage.summary_markdown && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold mb-1">Summary</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {stripMarkdown(voyage.summary_markdown)}
            </p>
          </div>
        )}

        {voyage.additional_information && (
          <div className="mt-4 bg-blue-50 rounded-xl p-4">
            <h3 className="font-semibold mb-1">Additional Information</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {voyage.additional_information}
            </p>
          </div>
        )}

        {voyage.notes_internal && (
          <div className="mt-4 bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold mb-1">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {voyage.notes_internal}
            </p>
          </div>
        )}

        {/* Source URLs */}
        {voyage.source_urls && voyage.source_urls.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Sources</h4>
            <ul className="space-y-1">
              {voyage.source_urls.map((source, index) => (
                <li key={index} className="text-sm text-gray-700">
                  {source.startsWith('http') ? (
                    <a
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all"
                    >
                      {source}
                    </a>
                  ) : (
                    <span>• {source}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Additional Sources */}
        {voyage.additional_sources && voyage.additional_sources.trim() && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Additional Sources</h4>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {voyage.additional_sources.split('\n').map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                return (
                  <div key={index} className="mb-1">
                    {trimmed.startsWith('http') ? (
                      <a
                        href={trimmed}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-800 hover:underline break-all"
                      >
                        {trimmed}
                      </a>
                    ) : (
                      <span>• {trimmed}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Media Gallery - General Media */}
      {generalMedia.length > 0 && (
        <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Media</h3>
          <MediaGallery voyageSlug={voyageSlug} />
        </section>
      )}

      {/* Sources - Media files */}
      {sourceMedia.length > 0 && (
        <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Sources</h3>
          <div className="space-y-3">
            {sourceMedia.map((source) => {
              // Build caption from date, credit, and description
              const captionParts: string[] = [];
              if (source.date) captionParts.push(source.date);
              if (source.credit) captionParts.push(source.credit);
              if (source.description_markdown) captionParts.push(source.description_markdown);
              const caption = captionParts.join(' — ') || 'Source Document';

              return (
                <div key={source.media_slug} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 mb-2">{caption}</p>
                      <a
                        href={source.url || source.s3_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        View Source →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Additional Sources - Media files */}
      {additionalSourceMedia.length > 0 && (
        <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Additional Sources</h3>
          <div className="space-y-3">
            {additionalSourceMedia.map((source) => {
              // Build caption from date, credit, and description
              const captionParts: string[] = [];
              if (source.date) captionParts.push(source.date);
              if (source.credit) captionParts.push(source.credit);
              if (source.description_markdown) captionParts.push(source.description_markdown);
              const caption = captionParts.join(' — ') || 'Additional Source Document';

              return (
                <div key={source.media_slug} className="border border-purple-200 rounded-lg p-4 hover:bg-purple-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 mb-2">{caption}</p>
                      <a
                        href={source.url || source.s3_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 hover:underline"
                      >
                        View Source →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* People - Split into Crew and Passengers */}
      <section className="bg-white rounded-2xl p-5 ring-1 ring-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">People</h3>
        {people.length === 0 ? (
          <p className="text-gray-600">No people recorded for this voyage.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crew Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase bg-blue-50 p-2 rounded">Crew</h4>
              {(() => {
                const crew = people.filter(p => p.is_crew);
                return crew.length > 0 ? (
                  <ul className="space-y-2">
                    {crew.map((p) => {
                      const bioLink = p.bio || p.wikipedia_url;
                      const roleToDisplay = p.role_title || p.title;
                      return (
                        <li key={p.person_slug} className="flex items-start gap-2 bg-blue-50 p-2 rounded">
                          <span className="mt-1">•</span>
                          <div className="text-sm flex-1">
                            <div className="font-medium">
                              {bioLink ? (
                                <a href={bioLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {p.full_name}
                                </a>
                              ) : (
                                p.full_name
                              )}
                            </div>
                            {roleToDisplay && <div className="text-gray-700">{roleToDisplay}</div>}
                            {p.voyage_notes && <div className="text-gray-600 text-xs mt-1">{p.voyage_notes}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">No crew members</p>
                );
              })()}
            </div>

            {/* Passengers Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase bg-gray-50 p-2 rounded">Passengers & Guests</h4>
              {(() => {
                const passengers = people.filter(p => !p.is_crew);
                return passengers.length > 0 ? (
                  <ul className="space-y-2">
                    {passengers.map((p) => {
                      const bioLink = p.bio || p.wikipedia_url;
                      const roleToDisplay = p.role_title || p.title;
                      return (
                        <li key={p.person_slug} className="flex items-start gap-2 bg-gray-50 p-2 rounded">
                          <span className="mt-1">•</span>
                          <div className="text-sm flex-1">
                            <div className="font-medium">
                              {bioLink ? (
                                <a href={bioLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {p.full_name}
                                </a>
                              ) : (
                                p.full_name
                              )}
                            </div>
                            {roleToDisplay && <div className="text-gray-700">{roleToDisplay}</div>}
                            {p.voyage_notes && <div className="text-gray-600 text-xs mt-1">{p.voyage_notes}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">No passengers</p>
                );
              })()}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
