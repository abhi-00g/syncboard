import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { setAuth } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side confirm password check
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const data = await register(email, password, displayName);
      setAuth(data.access_token, data.user);
      navigate("/boards");
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.detail;
        if (typeof detail === "string") {
          setError(detail);
        } else if (
          Array.isArray((detail as Record<string, unknown>)?.detail)
        ) {
          // Pydantic validation errors come as an array
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const messages = (detail as any).detail.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e: any) => e.msg
          );
          setError(messages.join(". "));
        } else {
          setError("Registration failed");
        }
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
            Create your account
          </h1>
          <p className="text-surface-500 mt-1">
            Start collaborating with your team
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
              htmlFor="displayName"
              className="block text-sm font-medium text-surface-700 mb-1"
            >
              Display name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-surface-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                text-surface-900 placeholder-surface-400"
              placeholder="Alex Chen"
            />
          </div>

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
              placeholder="Min 8 chars, uppercase, number, special"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-surface-700 mb-1"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-surface-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                text-surface-900 placeholder-surface-400"
              placeholder="Re-enter your password"
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-surface-500 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-brand-500 font-medium hover:text-brand-600"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
