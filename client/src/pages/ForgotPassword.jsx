import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Forgot Password</h2>

        {sent ? (
          <div className="text-center">
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <p className="text-gray-600 mb-4">
              If that email is registered, a password reset link has been sent. Check your inbox.
            </p>
            <Link to="/login" className="text-yellow-500 font-semibold hover:underline">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-semibold py-2 rounded transition disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">
              <Link to="/login" className="text-yellow-500 hover:underline">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
