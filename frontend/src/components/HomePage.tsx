import React from "react";
import Layout from "./Layout";

export default function HomePage() {
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          {/* Welcome Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-light text-amber-900 mb-4 tracking-wide">
              USS Sequoia Archive
            </h1>
            <p className="text-lg text-amber-800/80 font-light max-w-2xl mx-auto leading-relaxed">
              Presidential maritime collection documenting voyages aboard America's most distinguished yacht
            </p>
          </div>

          {/* About Section - Clean Cards */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 mb-16">
            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-sm border border-amber-200/30 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-700 to-amber-800 rounded-sm mb-6 flex items-center justify-center">
                <span className="text-white text-lg">⚓</span>
              </div>
              <h3 className="text-lg font-medium text-amber-900 mb-3 tracking-wide">
                Presidential Voyages
              </h3>
              <p className="text-amber-800/70 font-light leading-relaxed">
                Detailed records of presidential trips and official state visits aboard the USS Sequoia
              </p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-sm border border-amber-200/30 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-700 to-amber-800 rounded-sm mb-6 flex items-center justify-center">
                <span className="text-white text-lg">📸</span>
              </div>
              <h3 className="text-lg font-medium text-amber-900 mb-3 tracking-wide">
                Historical Media
              </h3>
              <p className="text-amber-800/70 font-light leading-relaxed">
                Photographs, documents, and multimedia from decades of presidential history
              </p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-sm border border-amber-200/30 shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-700 to-amber-800 rounded-sm mb-6 flex items-center justify-center">
                <span className="text-white text-lg">👥</span>
              </div>
              <h3 className="text-lg font-medium text-amber-900 mb-3 tracking-wide">
                Distinguished Passengers
              </h3>
              <p className="text-amber-800/70 font-light leading-relaxed">
                Comprehensive directory of passengers, crew, and officials who traveled aboard
              </p>
            </div>
          </div>

          {/* Stats Section - Minimal */}
          <div className="bg-white/40 backdrop-blur-sm border border-amber-200/30 rounded-sm p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-2xl font-light text-amber-900 mb-1">86</div>
                <div className="text-sm text-amber-800/70 font-light tracking-wide">Voyages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-amber-900 mb-1">12</div>
                <div className="text-sm text-amber-800/70 font-light tracking-wide">Presidents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-amber-900 mb-1">847</div>
                <div className="text-sm text-amber-800/70 font-light tracking-wide">Passengers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-light text-amber-900 mb-1">1925</div>
                <div className="text-sm text-amber-800/70 font-light tracking-wide">Established</div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <p className="text-amber-800/60 font-light text-sm tracking-wide">
              Navigate using the tabs above to explore the collection
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}