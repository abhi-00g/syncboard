import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email, password);
      setAuth(data.access_token, data.user);
      navigate("/boards");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          typeof err.detail === "string" ? err.detail : "Login failed"
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-surface-900">
            Welcome back
          </h1>
          <p className="text-surface-500 mt-1">
            Sign in to your SyncBoard account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-surface-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-surface-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                text-surface-900 placeholder-surface-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-surface-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-surface-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                text-surface-900 placeholder-surface-400"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-500 text-white font-medium rounded-lg
              hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500
              focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-surface-500 mt-6">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-brand-500 font-medium hover:text-brand-600"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
