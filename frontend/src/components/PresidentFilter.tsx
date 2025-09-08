import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { President } from "../types";

/** Dropdown tied to `president_slug` query param. */
const PresidentFilter: React.FC = () => {
  const [presidents, setPresidents] = useState<President[]>([]);
  const [params, setParams] = useSearchParams();
  const active = params.get("president_slug") ?? "";

  useEffect(() => {
    fetch("/api/presidents")
      .then((r) => r.json())
      .then(setPresidents)
      .catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(params);
    e.target.value ? next.set("president_slug", e.target.value) : next.delete("president_slug");
    setParams(next);
  };

  return (
    <select value={active} onChange={handleChange} className="px-3 py-2 border rounded bg-white text-gray-800">
      <option value="">All administrations</option>
      {presidents.map((p) => (
        <option key={p.president_slug} value={p.president_slug}>
          {p.full_name}
        </option>
      ))}
    </select>
  );
};

export default PresidentFilter;
