import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./components/HomePage";
import VoyageList from "./components/VoyageList";
import VoyageDetail from "./components/VoyageDetail";
import PresidentDirectory from "./components/PresidentDirectory";
import PresidentVoyages from "./components/PresidentVoyages";
import "./index.css";

// Test comment to trigger unified deployment system - with logging fix

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/voyages" element={<VoyageList />} />
      {/* slug-based */}
      <Route path="/voyages/:slug" element={<VoyageDetail />} />

      <Route path="/presidents" element={<PresidentDirectory />} />
      {/* slug-based */}
      <Route path="/presidents/:slug" element={<PresidentVoyages />} />
    </Routes>
  </BrowserRouter>
);

export default App;
