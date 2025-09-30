import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import IngestProgressBar from "./IngestProgressBar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/voyages", label: "Voyages" },
    { path: "/people", label: "Passengers" },
    { path: "/curators", label: "For Curators" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Site-wide Ingest Progress Bar */}
      <IngestProgressBar />

      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link
                  to="/"
                  className="text-xl font-medium text-gray-900 hover:text-gray-700 transition-colors"
                >
                  USS Sequoia Archive
                </Link>
              </div>
              <div className="hidden sm:ml-12 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2 ${
                      isActive(item.path)
                        ? "text-gray-900 border-gray-900"
                        : "text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 text-sm font-medium transition-colors border border-gray-300 hover:border-gray-400 rounded"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="sm:hidden bg-white border-t border-gray-200">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-3 text-base font-medium ${
                  isActive(item.path)
                    ? "text-gray-900 bg-gray-100"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-6 px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-600 text-sm">
              USS Sequoia Presidential Yacht Archive
            </p>
            <p className="text-gray-500 text-xs mt-2">
              &copy; 2025 • Equator Capital LLC
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
