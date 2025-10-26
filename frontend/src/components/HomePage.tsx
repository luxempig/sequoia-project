import React from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";

export default function HomePage() {
  return (
    <Layout>
      <div
        className="min-h-screen bg-gray-50"
        style={{
          backgroundImage: 'url(/sequoia-office.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: 'rgba(249, 250, 251, 0.75)',
          backgroundBlendMode: 'overlay'
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
          {/* About Section */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              About the USS Sequoia Archive
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A comprehensive digital collection of presidential voyages aboard
              America's most distinguished yacht
            </p>
          </div>

          {/* Help Needed Banner */}
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-3xl mx-auto">
            <p className="text-sm text-gray-700 text-center">
              In addition to currently unresearched voyages, we need help migrating data from{' '}
              <a
                href="https://docs.google.com/document/d/1i6zyig7Tg84fGmH8mU9wfQMPbZZ3_iwxf64LWbKgh6Y/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline font-medium"
              >
                this Google doc
              </a>
              ! Feel free to use the voyage editor to fill in missing information.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              to="/voyages"
              className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Voyages
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Explore presidential voyages with interactive timeline and detailed records of each trip aboard the USS Sequoia
              </p>
            </Link>

            <Link
              to="/people"
              className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Passengers
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Browse the directory of distinguished guests, crew, and officials who sailed aboard the presidential yacht
              </p>
            </Link>

            <Link
              to="/media-explorer"
              className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Media Explorer
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Browse and manage the media library with advanced search and organization tools
              </p>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
