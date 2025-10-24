// src/api.ts
import { President, Voyage, Person, MediaItem } from "./types";

const API_BASE = "";
const TIMEOUT = 15000;

async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export const api = {
  /** Presidents (slug-based) */
  listPresidents: () => getJSON<President[]>("/api/presidents"),
  voyagesByPresident: (slug: string) =>
    getJSON<Voyage[]>(`/api/presidents/${encodeURIComponent(slug)}/voyages`),

  /** Voyages (slug-based) */
  listVoyages: (params: URLSearchParams) =>
    getJSON<Voyage[]>(`/api/voyages${params.toString() ? "?" + params : ""}`),
  getVoyage: (voyageSlug: string) =>
    getJSON<Voyage>(`/api/voyages/${encodeURIComponent(voyageSlug)}`),
  getAdjacentVoyages: (voyageSlug: string) =>
    getJSON<{ previous: Voyage | null; next: Voyage | null }>(`/api/voyages/${encodeURIComponent(voyageSlug)}/adjacent`),

  /** People on voyage */
  getVoyagePeople: (voyageSlug: string) =>
    getJSON<Person[]>(`/api/people/by-voyage/${encodeURIComponent(voyageSlug)}`),

  /** Media for voyage (presigned URLs provided by backend) */
  getVoyageMedia: (voyageSlug: string) =>
    getJSON<MediaItem[]>(`/api/media/by-voyage/${encodeURIComponent(voyageSlug)}`),

  /** Generic GET method for new endpoints */
  get: <T = any>(path: string) => getJSON<T>(path),

  /** People API */
  listPeople: (params?: URLSearchParams) =>
    getJSON<Person[]>(`/api/people${params?.toString() ? "?" + params : ""}`),
  getPerson: (personSlug: string) =>
    getJSON<any>(`/api/people/${encodeURIComponent(personSlug)}`),
  getPeopleStats: () =>
    getJSON<any>("/api/people/roles/stats"),
  getPeopleGroupedByPresident: () =>
    getJSON<any>("/api/people/grouped-by-president"),

  /** Media API */
  listMedia: (params?: URLSearchParams) =>
    getJSON<MediaItem[]>(`/api/media${params?.toString() ? "?" + params : ""}`),
  getMedia: (mediaSlug: string, presign = false) =>
    getJSON<any>(`/api/media/${encodeURIComponent(mediaSlug)}${presign ? '?presign=true' : ''}`),
  getMediaStats: () =>
    getJSON<any>("/api/media/types/stats"),
  getMediaRelatedVoyages: (mediaSlug: string) =>
    getJSON<any[]>(`/api/media/${encodeURIComponent(mediaSlug)}/related-voyages`),

  /** Analytics API */
  getDashboard: () =>
    getJSON<any>("/api/analytics/dashboard"),
  getTimeline: () =>
    getJSON<any[]>("/api/analytics/timeline"),
  getSearchSuggestions: (query: string) =>
    getJSON<any>(`/api/analytics/search/suggestions?q=${encodeURIComponent(query)}`),
};
