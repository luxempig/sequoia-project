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
    { path: '/', label: 'Home' },
    { path: '/voyages', label: 'Voyages' },
    { path: '/presidents', label: 'Presidents' },
    { path: '/people', label: 'Passengers' },
    { path: '/media', label: 'Media' },
    { path: '/admin', label: 'Admin' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100">
      {/* Navigation Header */}
      <nav className="bg-gradient-to-r from-amber-950 to-amber-900 border-b border-amber-800/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/" className="flex items-center space-x-3 text-xl font-light text-amber-200 hover:text-amber-100 transition-colors">
                  <span className="text-2xl tracking-wider font-light">USS Sequoia Archive</span>
                </Link>
              </div>
              <div className="hidden sm:ml-12 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-2 text-sm font-light tracking-wide transition-all duration-200 border-b-2 ${
                      isActive(item.path)
                        ? 'text-amber-100 border-amber-300'
                        : 'text-amber-300 border-transparent hover:text-amber-100 hover:border-amber-400/50'
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
                className="text-amber-300 hover:text-amber-100 px-4 py-2 text-sm font-light tracking-wide transition-all duration-200 border border-amber-700 hover:border-amber-500 rounded-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="sm:hidden bg-amber-900/50 border-t border-amber-800/30">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-3 text-base font-light tracking-wide ${
                  isActive(item.path)
                    ? 'text-amber-100 bg-amber-800/30'
                    : 'text-amber-300 hover:text-amber-100 hover:bg-amber-800/20'
                }`}
              >
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
      <footer className="bg-gradient-to-r from-amber-950 to-amber-900 border-t border-amber-800/30">
        <div className="max-w-7xl mx-auto py-6 px-6 lg:px-8">
          <div className="text-center">
            <p className="text-amber-300 text-sm font-light tracking-wide">
              USS Sequoia Presidential Yacht Archive
            </p>
            <p className="text-amber-400/70 text-xs font-light mt-2">
              &copy; 2025 • Historical maritime records
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;