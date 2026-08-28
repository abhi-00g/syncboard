import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Columns3, AlertCircle, Check } from "lucide-react";
import { register, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const PASSWORD_RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special char", test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

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
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const data = await register(email, password, displayName);
      setAuth(data.access_token, data.user);
      navigate("/boards");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === "string" ? err.detail : "Registration failed");
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  const allRulesPass = PASSWORD_RULES.every((r) => r.test(password));

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-100 px-4 py-12">
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

        <h1 className="text-xl font-semibold text-surface-900 mb-1">Create your account</h1>
        <p className="text-sm text-surface-500 mb-8">Start collaborating with your team</p>

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
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Display name</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              required placeholder="Alex Chen"
              className="w-full px-3 py-2.5 bg-surface-200/50 border border-surface-200 rounded-lg
                text-surface-800 placeholder-surface-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50
                transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-surface-200/50 border border-surface-200 rounded-lg
                text-surface-800 placeholder-surface-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50
                transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required placeholder="Create a strong password"
              className="w-full px-3 py-2.5 bg-surface-200/50 border border-surface-200 rounded-lg
                text-surface-800 placeholder-surface-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50
                transition-colors" />
            {password.length > 0 && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }}
                className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
                {PASSWORD_RULES.map((rule) => (
                  <span key={rule.label}
                    className={`flex items-center gap-1 text-xs transition-colors
                      ${rule.test(password) ? "text-brand-500" : "text-surface-400"}`}>
                    <Check size={11} className={rule.test(password) ? "opacity-100" : "opacity-30"} />
                    {rule.label}
                  </span>
                ))}
              </motion.div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-500 mb-1.5">Confirm password</label>
            <input type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required placeholder="Re-enter your password"
              className={`w-full px-3 py-2.5 bg-surface-200/50 border rounded-lg
                text-surface-800 placeholder-surface-400 text-sm
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50
                transition-colors
                ${confirmPassword && confirmPassword !== password
                  ? "border-red-500/40"
                  : "border-surface-200"}`} />
          </div>

          <button type="submit" disabled={loading || !allRulesPass}
            className="w-full py-2.5 bg-brand-500 text-surface-0 font-semibold text-sm rounded-lg
              hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-surface-400 mt-8">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-500 font-medium hover:text-brand-600 transition-colors">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
