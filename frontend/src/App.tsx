import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// Reverted to working state - testing workflow trigger

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/LoginScreen";
import HomePage from "./components/HomePage";
import VoyageList from "./components/VoyageList";
import VoyageDetail from "./components/VoyageDetail";
import VoyageEditor from "./components/VoyageEditor";
import PeopleDirectory from "./components/PeopleDirectory";
import PersonDetail from "./components/PersonDetail";
import MediaExplorer from "./components/MediaExplorer";
import "./index.css";

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voyages" element={<VoyageList />} />
        <Route path="/voyages/new" element={<VoyageEditor />} />
        <Route path="/voyages/:slug/edit" element={<VoyageEditor />} />
        <Route path="/voyages/:slug" element={<VoyageDetail />} />

        <Route path="/people" element={<PeopleDirectory />} />
        <Route path="/people/:slug" element={<PersonDetail />} />

        <Route path="/media-explorer" element={<MediaExplorer />} />
      </Routes>
    </BrowserRouter>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
