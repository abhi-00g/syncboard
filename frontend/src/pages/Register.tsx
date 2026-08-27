import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Columns3, AlertCircle, Check } from "lucide-react";
import { register, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

const PASSWORD_RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character", test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
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
        setError(typeof err.detail === "string" ? err.detail : "Registration failed. Check your inputs.");
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  const allRulesPass = PASSWORD_RULES.every((r) => r.test(password));

  return (
    <div className="min-h-screen flex bg-surface-50">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700
        items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Columns3 size={22} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white">SyncBoard</span>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Your team's work, always in sync
          </h2>
          <p className="text-brand-100 text-lg leading-relaxed">
            WebSocket-powered real-time collaboration. Every card move, every comment,
            every update — delivered instantly.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg
              flex items-center justify-center shadow-sm">
              <Columns3 size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-surface-900">SyncBoard</span>
          </div>

          <h1 className="text-2xl font-bold text-surface-900 mb-1">Create your account</h1>
          <p className="text-surface-500 mb-8">Start collaborating with your team</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700
                  px-4 py-3 rounded-xl text-sm"
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-surface-700 mb-1.5">Display name</label>
              <input id="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                required placeholder="Alex Chen"
                className="w-full px-4 py-2.5 border border-surface-300 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                  text-surface-900 placeholder-surface-400" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1.5">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-surface-300 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                  text-surface-900 placeholder-surface-400" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-surface-700 mb-1.5">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required placeholder="Create a strong password"
                className="w-full px-4 py-2.5 border border-surface-300 rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                  text-surface-900 placeholder-surface-400" />
              {password.length > 0 && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }}
                  className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {PASSWORD_RULES.map((rule) => (
                    <span key={rule.label} className={`flex items-center gap-1 text-xs transition-colors
                      ${rule.test(password) ? "text-emerald-600" : "text-surface-400"}`}>
                      <Check size={12} className={rule.test(password) ? "opacity-100" : "opacity-30"} />
                      {rule.label}
                    </span>
                  ))}
                </motion.div>
              )}
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-surface-700 mb-1.5">Confirm password</label>
              <input id="confirm" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required placeholder="Re-enter your password"
                className={`w-full px-4 py-2.5 border rounded-xl
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                  text-surface-900 placeholder-surface-400 transition-colors
                  ${confirmPassword && confirmPassword !== password
                    ? "border-red-300 bg-red-50/50"
                    : "border-surface-300"}`} />
            </div>

            <button type="submit" disabled={loading || !allRulesPass}
              className="w-full py-2.5 bg-brand-500 text-white font-semibold rounded-xl
                hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500
                focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
                shadow-sm shadow-brand-500/20 hover:shadow-md hover:shadow-brand-500/30
                transition-all active:scale-[0.98]">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-surface-500 mt-8">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-500 font-semibold hover:text-brand-600 transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
