import React from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { Voyage } from "../types";

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

const fmtRange = (start?: string | null, end?: string | null) => {
  if (!start) return "Date unknown";
  const a = dayjs(start);
  const b = end ? dayjs(end) : null;
  return b && b.isValid() && !a.isSame(b, "day")
    ? `${a.format("MMM D, YYYY")} – ${b.format("MMM D, YYYY")}`
    : a.format("MMM D, YYYY");
};

const VoyageCard: React.FC<{ voyage: Voyage; groupName?: string }> = ({ voyage }) => {
  const significant = voyage.significant === 1 || voyage.significant === true;
  const royalty = voyage.royalty === 1 || voyage.royalty === true;

  return (
    <div className="timeline-item">
      <div className="timeline-content w-full">
        <Link
          to={`/voyages/${voyage.voyage_slug}`}
          className="block bg-white p-4 rounded-xl shadow-sm ring-1 ring-gray-200 hover:shadow-md transition"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-sm sm:text-base font-semibold">
              {fmtRange(voyage.start_date, voyage.end_date)}
            </h3>
            <div className="flex gap-2">
              {significant && <Badge>Significant</Badge>}
              {royalty && <Badge tone="violet">Royalty</Badge>}
            </div>
          </div>
          {voyage.summary_markdown && (
            <p className="text-sm text-gray-600 line-clamp-2">{voyage.summary_markdown}</p>
          )}
        </Link>
      </div>
    </div>
  );
};

export default VoyageCard;
