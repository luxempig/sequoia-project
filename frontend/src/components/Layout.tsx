import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/voyages', label: 'Voyages', icon: '🚢' },
    { path: '/presidents', label: 'Presidents', icon: '🎩' },
    { path: '/people', label: 'People', icon: '👥' },
    { path: '/media', label: 'Media', icon: '📸' },
    { path: '/admin', label: 'Admin', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-100">
      {/* Navigation Header */}
      <nav className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 shadow-2xl border-b-4 border-amber-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="flex items-center space-x-3 text-xl font-bold text-amber-100 hover:text-amber-50 transition-colors font-serif">
                  <div className="w-12 h-12 bg-gradient-to-b from-amber-600 to-amber-700 rounded-full flex items-center justify-center border-3 border-amber-400 shadow-lg">
                    <span className="text-xl text-amber-50">⚓</span>
                  </div>
                  <span>USS Sequoia Archive</span>
                </Link>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-md font-serif transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-amber-600 text-amber-50 shadow-lg border-2 border-amber-400'
                        : 'text-amber-200 hover:text-amber-50 hover:bg-amber-700/50 border-2 border-transparent hover:border-amber-500/50'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="bg-amber-700/50 hover:bg-amber-600 text-amber-100 hover:text-amber-50 px-4 py-2 rounded-md text-sm font-semibold font-serif transition-all duration-200 border-2 border-amber-500/50 hover:border-amber-400"
              >
                Disembark
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="sm:hidden bg-amber-800/80 border-t border-amber-600">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block pl-4 pr-4 py-3 text-base font-semibold font-serif ${
                  isActive(item.path)
                    ? 'text-amber-50 bg-amber-600 border-r-4 border-amber-300 shadow-lg'
                    : 'text-amber-200 hover:text-amber-50 hover:bg-amber-700/50'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 border-t-4 border-amber-600">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-8 h-8 bg-gradient-to-b from-amber-600 to-amber-700 rounded-full flex items-center justify-center border-2 border-amber-400 shadow-lg mr-3">
                <span className="text-sm text-amber-50">⚓</span>
              </div>
              <p className="text-amber-200 text-lg font-serif font-semibold">USS Sequoia Presidential Yacht Archive</p>
            </div>
            <p className="text-amber-300/80 text-sm font-serif italic">
              Preserving maritime presidential history • Est. 1925
            </p>
            <div className="mt-4 border-t border-amber-700 pt-4">
              <p className="text-amber-400/70 text-xs font-serif">
                &copy; 2025 • Historical records and maritime archives • Old Money Curation Co.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;