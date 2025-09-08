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

  /** People on voyage */
  getVoyagePeople: (voyageSlug: string) =>
    getJSON<Person[]>(`/api/people/by-voyage/${encodeURIComponent(voyageSlug)}`),

  /** Media for voyage (presigned URLs provided by backend) */
  getVoyageMedia: (voyageSlug: string) =>
    getJSON<MediaItem[]>(`/api/media/by-voyage/${encodeURIComponent(voyageSlug)}`),
};
