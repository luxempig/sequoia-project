import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(username, password);
    
    if (!success) {
      setError('Invalid credentials. Please try again.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-left"
        style={{ backgroundImage: "url(/leon.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/40 via-amber-800/50 to-slate-900/70" />

      {/* Login Form */}
      <div className="relative z-10 bg-gradient-to-b from-amber-50/95 to-amber-100/95 backdrop-blur-sm rounded-lg p-8 w-full max-w-md mx-4 border-2 border-amber-200/50 shadow-2xl">
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-b from-amber-600 to-amber-800 rounded-full flex items-center justify-center border-4 border-amber-300 shadow-lg">
              <span className="text-2xl text-amber-50">⚓</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-amber-900 mb-2 font-serif">USS Sequoia Archive</h1>
          <p className="text-amber-800/90 font-serif italic">Presidential Maritime Collection</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-amber-900 mb-2 font-serif">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-amber-50/80 border-2 border-amber-300/60 text-amber-900 placeholder-amber-700/50 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 font-serif shadow-inner"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-amber-900 mb-2 font-serif">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-md bg-amber-50/80 border-2 border-amber-300/60 text-amber-900 placeholder-amber-700/50 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 font-serif shadow-inner"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-300 rounded-md p-3 shadow-inner">
              <p className="text-red-800 text-sm font-serif">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-md bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-amber-50 font-semibold font-serif transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg border-2 border-amber-500"
          >
            {loading ? 'Authenticating...' : 'Board the Archive'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-amber-800/70 text-xs font-serif italic">
            Authorized maritime historians only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;