// src/types.ts (slug-based schema)

export interface President {
  president_slug: string;
  full_name: string;
  term_start: string;          // ISO date
  term_end: string | null;     // ISO or null
  party?: string | null;
}

export interface Voyage {
  voyage_slug: string;
  title?: string | null;
  start_date: string | null;   // ISO date
  end_date: string | null;     // ISO date
  start_time?: string | null;  // Time component
  end_time?: string | null;    // Time component
  start_timestamp?: string | null;  // Combined timestamp
  end_timestamp?: string | null;    // Combined timestamp
  origin?: string | null;
  destination?: string | null;
  start_location?: string | null;   // Replaces origin
  end_location?: string | null;     // Replaces destination
  voyage_type?: string | null;
  summary_markdown?: string | null;
  notes_internal?: string | null;   // Internal curator notes
  additional_information?: string | null;  // Public-facing additional info
  additional_sources?: string | null;
  tags?: string | null;
  // denormalized hint to group by presidency (from your schema)
  president_slug_from_voyage?: string | null;

  // Flags kept for continuity (optional; may be absent in new schema)
  significant?: number | boolean;
  royalty?: number | boolean;
}

export interface Person {
  person_slug: string;
  full_name: string;
  role?: string | null;  // Updated from role_title
  title?: string | null; // New field
  organization?: string | null;
  birth_year?: number | null;
  death_year?: number | null;
  bio?: string | null;    // Updated from wikipedia_url
  notes_internal?: string | null;
  tags?: string | null;

  // From voyage_passengers join (when fetched via by-voyage)
  capacity_role?: string | null;
  voyage_notes?: string | null;

  // Legacy fields for backward compatibility
  role_title?: string | null;
  wikipedia_url?: string | null;
}

export interface MediaItem {
  media_slug: string;
  title?: string | null;
  media_type?: string | null; // image, pdf, video, etc.
  url?: string | null;        // presigned/fallback from backend
  s3_url?: string | null;     // original (not used by FE if url present)
  public_derivative_url?: string | null;
  credit?: string | null;
  date?: string | null;
  description_markdown?: string | null;
  tags?: string | null;

  // From voyage_media join (when using /media/by-voyage)
  sort_order?: number | null;
  voyage_media_notes?: string | null;
}
