import React from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { Voyage } from "../types";

const Badge: React.FC<{ tone?: "amber" | "violet"; children: React.ReactNode }> = ({
  tone = "amber",
  children,
}) => (
  <span
    className={`inline-flex px-2 py-1 text-xs font-medium rounded border
     ${
       tone === "amber"
         ? "bg-gray-100 text-gray-800 border-gray-200"
         : "bg-blue-100 text-blue-800 border-blue-200"
     }`}
  >
    {children}
  </span>
);

// Same tag color generator as in VoyageList
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
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const fmtRange = (start?: string | null, end?: string | null) => {
  if (!start) return "Date unknown";
  const a = dayjs(start);
  const b = end ? dayjs(end) : null;
  return b && b.isValid() && !a.isSame(b, "day")
    ? `${a.format("MMM D, YYYY")} – ${b.format("MMM D, YYYY")}`
    : a.format("MMM D, YYYY");
};

const fmtTimestamp = (timestamp?: string | null) => {
  if (!timestamp) return null;
  try {
    const dt = dayjs(timestamp);
    return dt.isValid() ? dt.format("MMM D, YYYY [at] h:mm A") : null;
  } catch {
    return null;
  }
};

const VoyageCard: React.FC<{ voyage: Voyage; groupName?: string }> = ({ voyage }) => {
  const significant = voyage.significant === 1 || voyage.significant === true;
  const royalty = voyage.royalty === 1 || voyage.royalty === true;

  // Parse tags from comma-separated string or JSON array
  const tags = (() => {
    if (!voyage.tags) return [];

    // Try to parse as JSON array first (if stored as ["tag1", "tag2"])
    try {
      const parsed = JSON.parse(voyage.tags);
      if (Array.isArray(parsed)) {
        return parsed.map(t => String(t).trim()).filter(Boolean);
      }
    } catch {
      // Not JSON, treat as comma-separated string
    }

    // Fallback to comma-separated parsing
    return voyage.tags.split(',').map(t => t.trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '')).filter(Boolean);
  })();

  return (
    <div className="timeline-item">
      <div className="timeline-content w-full">
        <Link
          to={`/voyages/${voyage.voyage_slug}`}
          className="block bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow hover:bg-gray-50"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900">
              {voyage.title || fmtRange(voyage.start_date, voyage.end_date)}
            </h3>
            <div className="flex gap-2">
              {significant && <Badge>Significant</Badge>}
              {royalty && <Badge tone="violet">Royalty</Badge>}
            </div>
          </div>

          {/* Date/Time and Locations */}
          <div className="text-xs text-gray-600 mt-2 space-y-1">
            <div>
              <strong>Start:</strong> {fmtTimestamp(voyage.start_timestamp) || fmtRange(voyage.start_date, null)}
              {(voyage.start_location || voyage.origin) && (
                <span className="ml-1">📍 {voyage.start_location || voyage.origin}</span>
              )}
            </div>
            <div>
              <strong>End:</strong> {fmtTimestamp(voyage.end_timestamp) || fmtRange(voyage.end_date, null)}
              {(voyage.end_location || voyage.destination) && (
                <span className="ml-1">📍 {voyage.end_location || voyage.destination}</span>
              )}
            </div>
          </div>

          {(voyage.additional_information || voyage.summary_markdown) && (
            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mt-2">
              {voyage.additional_information || voyage.summary_markdown}
            </p>
          )}
          {voyage.notes_internal && (
            <p className="text-sm text-gray-500 italic line-clamp-2 leading-relaxed mt-2">
              Notes: {voyage.notes_internal}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag, idx) => {
                const color = getTagColor(tag);
                return (
                  <span
                    key={`${tag}-${idx}`}
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${color.bg} ${color.text} ${color.border}`}
                  >
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </Link>
      </div>
    </div>
  );
};

export default VoyageCard;
