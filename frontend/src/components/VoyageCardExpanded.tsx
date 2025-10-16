import React, { useState } from "react";
import dayjs from "dayjs";
import { Voyage } from "../types";

interface VoyageCardExpandedProps {
  voyage: Voyage;
  editMode: boolean;
  onSave?: (voyage: Voyage) => void;
}

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
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-*+]\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
};

const VoyageCardExpanded: React.FC<VoyageCardExpandedProps> = ({ voyage, editMode, onSave }) => {
  const [editedVoyage, setEditedVoyage] = useState<Voyage>(voyage);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    if (onSave) {
      await onSave(editedVoyage);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedVoyage(voyage);
    setIsEditing(false);
  };

  const updateField = (field: keyof Voyage, value: any) => {
    setEditedVoyage(prev => ({ ...prev, [field]: value }));
  };

  const booleanFields = [
    { key: 'has_photo' as keyof Voyage, label: 'Has Photos' },
    { key: 'has_video' as keyof Voyage, label: 'Has Video' },
    { key: 'presidential_use' as keyof Voyage, label: 'Presidential Use' },
    { key: 'has_royalty' as keyof Voyage, label: 'Royalty Present' },
    { key: 'has_foreign_leader' as keyof Voyage, label: 'Foreign Leader Present' },
    { key: 'mention_camp_david' as keyof Voyage, label: 'Camp David' },
    { key: 'mention_mount_vernon' as keyof Voyage, label: 'Mount Vernon' },
    { key: 'mention_captain' as keyof Voyage, label: 'Captain' },
    { key: 'mention_crew' as keyof Voyage, label: 'Crew' },
    { key: 'mention_rmd' as keyof Voyage, label: 'RMD' },
    { key: 'mention_yacht_spin' as keyof Voyage, label: 'Yacht Spin' },
    { key: 'mention_menu' as keyof Voyage, label: 'Menu Info' },
    { key: 'mention_drinks_wine' as keyof Voyage, label: 'Drinks/Wine' },
  ];

  const activeTags = booleanFields
    .filter(field => voyage[field.key] === true)
    .map(field => field.label);

  const currentVoyage = isEditing ? editedVoyage : voyage;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={currentVoyage.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              className="text-xl font-semibold w-full border rounded px-2 py-1"
              placeholder="Voyage Title"
            />
          ) : (
            <h3 className="text-xl font-semibold text-gray-900">
              {currentVoyage.title || `Voyage ${currentVoyage.voyage_slug}`}
            </h3>
          )}
        </div>

        {editMode && (
          <div className="ml-4">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Type */}
      {currentVoyage.voyage_type && (
        <div className="mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800 font-medium capitalize text-sm">
            {currentVoyage.voyage_type}
          </span>
        </div>
      )}

      {/* Date and Time Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <strong className="text-gray-900">Start:</strong>
          <div className="text-gray-700">
            {formatDateTime(currentVoyage.start_timestamp) || formatDate(currentVoyage.start_date)}
          </div>
          {(currentVoyage.start_location || currentVoyage.origin) && (
            <div className="text-gray-600 text-xs mt-1">
              {currentVoyage.start_location || currentVoyage.origin}
            </div>
          )}
        </div>

        <div>
          <strong className="text-gray-900">End:</strong>
          <div className="text-gray-700">
            {formatDateTime(currentVoyage.end_timestamp) || formatDate(currentVoyage.end_date)}
          </div>
          {(currentVoyage.end_location || currentVoyage.destination) && (
            <div className="text-gray-600 text-xs mt-1">
              {currentVoyage.end_location || currentVoyage.destination}
            </div>
          )}
        </div>
      </div>

      {/* Boolean Attributes */}
      {activeTags.length > 0 && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Voyage Attributes</h4>
          <div className="flex flex-wrap gap-2">
            {activeTags.map((tag, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {currentVoyage.summary_markdown && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Summary</h4>
          {isEditing ? (
            <textarea
              value={currentVoyage.summary_markdown}
              onChange={(e) => updateField('summary_markdown', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={4}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {stripMarkdown(currentVoyage.summary_markdown)}
            </p>
          )}
        </div>
      )}

      {/* Additional Information */}
      {currentVoyage.additional_information && (
        <div className="mb-4 bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Additional Information</h4>
          {isEditing ? (
            <textarea
              value={currentVoyage.additional_information}
              onChange={(e) => updateField('additional_information', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={3}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {currentVoyage.additional_information}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      {currentVoyage.notes_internal && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-sm mb-2">Notes</h4>
          {isEditing ? (
            <textarea
              value={currentVoyage.notes_internal}
              onChange={(e) => updateField('notes_internal', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={2}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {currentVoyage.notes_internal}
            </p>
          )}
        </div>
      )}

      {/* Source URLs */}
      {currentVoyage.source_urls && currentVoyage.source_urls.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Sources</h4>
          <ul className="space-y-1">
            {currentVoyage.source_urls.map((source, index) => (
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
    </div>
  );
};

export default VoyageCardExpanded;
