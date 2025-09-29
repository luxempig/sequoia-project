import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// Reverted to working state - testing workflow trigger

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/LoginScreen";
import HomePage from "./components/HomePage";
import VoyageList from "./components/VoyageList";
import VoyageDetail from "./components/VoyageDetail";
import PresidentDirectory from "./components/PresidentDirectory";
import PresidentVoyages from "./components/PresidentVoyages";
import PeopleDirectory from "./components/PeopleDirectory";
import PersonDetail from "./components/PersonDetail";
// import JsonCuratorInterface from "./components/JsonCuratorInterface";
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
        <Route path="/voyages/:slug" element={<VoyageDetail />} />
        
        <Route path="/presidents" element={<PresidentDirectory />} />
        <Route path="/presidents/:slug" element={<PresidentVoyages />} />
        
        <Route path="/people" element={<PeopleDirectory />} />
        <Route path="/people/:slug" element={<PersonDetail />} />

        <Route path="/curators" element={<div>Curator interface temporarily disabled</div>} />
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
