// src/components/VoyageDetail.tsx
import { api } from "../api";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VoyageCardExpanded from "./VoyageCardExpanded";
import { Voyage } from "../types";

export default function VoyageDetail() {
  const { slug } = useParams<{ slug: string }>();
  const voyageSlug = slug!;
  const navigate = useNavigate();

  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [adjacentVoyages, setAdjacentVoyages] = useState<{ previous: Voyage | null; next: Voyage | null }>({ previous: null, next: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [v, adj] = await Promise.all([
          api.getVoyage(voyageSlug).catch(() => null),
          api.getAdjacentVoyages(voyageSlug).catch(() => ({ previous: null, next: null })),
        ]);
        if (!alive) return;
        setVoyage(v);
        setAdjacentVoyages(adj);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [voyageSlug]);

  const handleVoyageSave = async (updatedVoyage: Voyage) => {
    try {
      const response = await fetch(`/api/curator/voyages/${updatedVoyage.voyage_slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedVoyage),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      setVoyage(updatedVoyage);
      alert('✓ Voyage saved successfully');
    } catch (error) {
      console.error('Error saving voyage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to save voyage: ${errorMessage}`);
    }
  };

  const handleVoyageDelete = async (voyageSlug: string) => {
    if (!confirm('Are you sure you want to delete this voyage?')) return;

    try {
      const response = await fetch(`/api/curator/voyages/${voyageSlug}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete voyage');
      }

      alert('Voyage deleted successfully');
      navigate('/voyages');
    } catch (error) {
      console.error('Error deleting voyage:', error);
      alert('Failed to delete voyage. Please try again.');
    }
  };

  if (loading) return <div className="p-4 max-w-7xl mx-auto"><p>Loading…</p></div>;
  if (!voyage) return <div className="p-4 max-w-7xl mx-auto"><p>Voyage not found</p></div>;

  return (
    <div className="px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            ← Back to voyages
          </button>

          {/* Adjacent Voyage Navigation */}
          <div className="flex gap-2">
            {adjacentVoyages.previous && (
              <button
                onClick={() => navigate(`/voyages/${adjacentVoyages.previous!.voyage_slug}`)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
                title={adjacentVoyages.previous.title || adjacentVoyages.previous.voyage_slug}
              >
                ← Previous
              </button>
            )}
            {adjacentVoyages.next && (
              <button
                onClick={() => navigate(`/voyages/${adjacentVoyages.next!.voyage_slug}`)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
                title={adjacentVoyages.next.title || adjacentVoyages.next.voyage_slug}
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Display voyage using VoyageCardExpanded for consistent styling */}
        <VoyageCardExpanded
          voyage={voyage}
          editMode={false}
          onSave={handleVoyageSave}
          onDelete={handleVoyageDelete}
        />
      </div>
    </div>
  );
}
