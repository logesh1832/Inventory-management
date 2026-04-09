import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
          <p className="text-red-500 font-semibold">Invalid or missing reset token.</p>
          <Link to="/login" className="text-yellow-500 hover:underline mt-4 block">Back to Login</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwords do not match.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const eyeIcon = (show, toggle) => (
    <button type="button" onClick={toggle} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset Password</h2>

        {success ? (
          <div className="text-center">
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <p className="text-gray-600">Password reset successfully! Redirecting to login...</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">Enter your new password below.</p>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder="Min. 6 characters"
                  />
                  {eyeIcon(showPassword, () => setShowPassword(v => !v))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className={`w-full border rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${confirm && password !== confirm ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="Repeat password"
                  />
                  {eyeIcon(showConfirm, () => setShowConfirm(v => !v))}
                </div>
                {confirm && password !== confirm && (
                  <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-semibold py-2 rounded transition disabled:opacity-60"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
