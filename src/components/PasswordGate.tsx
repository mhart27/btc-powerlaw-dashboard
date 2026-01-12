'use client';

import { useState, useEffect, ReactNode } from 'react';

const AUTH_STORAGE_KEY = 'btc-powerlaw-auth';

interface PasswordGateProps {
  children: ReactNode;
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      setIsAuthenticated(stored === 'true');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        setIsAuthenticated(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid password');
      }
    } catch {
      setError('Failed to authenticate. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setPassword('');
  };

  // Show nothing while checking auth status
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-gray-800 rounded-lg p-6 md:p-8 shadow-xl border border-gray-700">
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Bitcoin Power Law Dashboard
            </h1>
            <p className="text-gray-400 text-center text-sm mb-6">
              Enter password to access
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Password"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="mb-4 text-red-400 text-sm text-center bg-red-900/30 border border-red-800 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-4 py-3 rounded font-medium transition-colors"
              >
                {isLoading ? 'Verifying...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Render children with logout button context
  return (
    <PasswordGateContext.Provider value={{ handleLogout }}>
      {children}
    </PasswordGateContext.Provider>
  );
}

// Context for logout functionality
import { createContext, useContext } from 'react';

interface PasswordGateContextType {
  handleLogout: () => void;
}

const PasswordGateContext = createContext<PasswordGateContextType | null>(null);

export function useAuth() {
  const context = useContext(PasswordGateContext);
  if (!context) {
    throw new Error('useAuth must be used within a PasswordGate');
  }
  return context;
}
