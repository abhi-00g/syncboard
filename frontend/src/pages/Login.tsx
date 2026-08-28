import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Columns3, AlertCircle } from "lucide-react";
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
        setError(typeof err.detail === "string" ? err.detail : "Login failed");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Columns3 size={16} className="text-surface-0" />
          </div>
          <span className="text-base font-bold text-surface-900">SyncBoard</span>
        </div>

        <h1 className="text-xl font-semibold text-surface-900 mb-1">Welcome back</h1>
        <p className="text-sm text-surface-500 mb-8">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/20
                text-red-400 px-3 py-2.5 rounded-lg text-sm"
            >
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">
              Email
            </label>
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-surface-200/50 border border-surface-200 rounded-lg
                text-surface-800 placeholder-surface-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50
                transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">
              Password
            </label>
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              placeholder="Enter your password"
              className="w-full px-3 py-2.5 bg-surface-200/50 border border-surface-200 rounded-lg
                text-surface-800 placeholder-surface-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50
                transition-colors"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-brand-500 text-surface-0 font-semibold text-sm rounded-lg
              hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-surface-400 mt-8">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand-500 font-medium hover:text-brand-600 transition-colors">
            Create one
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
