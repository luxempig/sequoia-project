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
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/70 via-amber-900/80 to-stone-900/90" />

      {/* Login Form */}
      <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-sm p-10 w-full max-w-md mx-4 border border-amber-200/30 shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-light text-amber-900 mb-2 tracking-wide">USS Sequoia Archive</h1>
          <p className="text-amber-800/70 font-light">Presidential Maritime Collection</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-light text-amber-900 mb-3 tracking-wide">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-sm bg-white border border-amber-300/40 text-amber-900 placeholder-amber-700/40 focus:outline-none focus:border-amber-600 transition-colors font-light"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-light text-amber-900 mb-3 tracking-wide">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-sm bg-white border border-amber-300/40 text-amber-900 placeholder-amber-700/40 focus:outline-none focus:border-amber-600 transition-colors font-light"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-3">
              <p className="text-red-800 text-sm font-light">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-sm bg-amber-800 hover:bg-amber-700 text-white font-light tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-amber-800/60 text-xs font-light tracking-wide">
            Authorized access only
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;