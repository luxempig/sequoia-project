import React from "react";
import Layout from "./Layout";
// Trigger deployment - reverted to commit 33c9d60

export default function HomePage() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          {/* About Section */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              About the USS Sequoia Archive
            </h1>
            {/* Deployment test indicator */}
            <div className="text-xs text-gray-400 mb-2">
              Version: EC2-Build-2025.10.01
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A comprehensive digital collection of presidential voyages aboard
              America's most distinguished yacht
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gray-900 rounded-lg mb-6 flex items-center justify-center">
                <span className="text-white text-lg">⚓</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Presidential Voyages
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Detailed records of presidential trips and official state visits
                aboard the USS Sequoia
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gray-900 rounded-lg mb-6 flex items-center justify-center">
                <span className="text-white text-lg">📸</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Historical Media
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Photographs, documents, and multimedia from decades of
                presidential history
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-gray-900 rounded-lg mb-6 flex items-center justify-center">
                <span className="text-white text-lg">👥</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Distinguished Passengers
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Comprehensive directory of passengers, crew, and officials who
                traveled aboard
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
