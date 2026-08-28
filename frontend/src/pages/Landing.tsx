import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  ArrowRight,
  Columns3,
  Radio,
  Shield,
  GripVertical,
} from "lucide-react";
import { guestLogin } from "../api/client";

export default function Landing() {
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");

  async function handleTryDemo() {
    setLoadingDemo(true);
    setDemoError("");
    try {
      const data = await guestLogin();
      // Store token directly — AuthContext will read it on next page load
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Full navigation ensures AuthContext initializes with the new token
      window.location.href = `/boards/${data.board_id}`;
    } catch {
      setDemoError("Could not start demo — please try again");
      setLoadingDemo(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Nav ─── */}
      <nav className="border-b border-surface-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <Columns3 size={15} className="text-white" />
            </div>
            <span className="text-base font-bold text-surface-900 tracking-tight">
              SyncBoard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-surface-600 hover:text-surface-900 transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium text-white bg-brand-500 hover:bg-brand-600
                px-4 py-1.5 rounded-lg transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-surface-900 tracking-tight leading-tight">
            Collaborate on tasks
            <br />
            in real time.
          </h1>
          <p className="mt-5 text-lg text-surface-500 leading-relaxed max-w-xl">
            SyncBoard is a Kanban board where every drag, edit, and comment
            syncs instantly across all connected users — no refresh needed.
          </p>

          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={handleTryDemo}
              disabled={loadingDemo}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-500 text-white
                text-sm font-semibold rounded-lg hover:bg-brand-600 transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingDemo ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Try the demo
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <Link
              to="/register"
              className="text-sm font-medium text-surface-600 hover:text-brand-500 transition-colors"
            >
              or create an account
            </Link>
          </div>

          {demoError && (
            <p className="mt-3 text-sm text-red-500">{demoError}</p>
          )}
        </motion.div>
      </section>

      {/* ─── Features ─── */}
      <section className="border-t border-surface-100 bg-surface-50/50">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-10">
            How it works
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Radio size={20} />}
              title="WebSocket sync"
              description="Every action broadcasts instantly via WebSocket. No polling, no stale state — all users see changes the moment they happen."
            />
            <FeatureCard
              icon={<GripVertical size={20} />}
              title="Drag-and-drop"
              description="Move cards between columns with native drag-and-drop. Optimistic updates show the move immediately while the server confirms."
            />
            <FeatureCard
              icon={<Users size={20} />}
              title="Live presence"
              description="See who else is viewing the board right now. Presence is tracked with Redis TTL — users appear and disappear in real time."
            />
            <FeatureCard
              icon={<Shield size={20} />}
              title="Concurrency control"
              description="Version numbers on every card prevent lost updates. If two people edit the same card, the second gets a conflict signal."
            />
          </div>
        </div>
      </section>

      {/* ─── Architecture callout ─── */}
      <section className="border-t border-surface-100">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
              Under the hood
            </h2>
            <p className="text-surface-600 leading-relaxed">
              FastAPI handles HTTP and WebSocket connections. PostgreSQL stores
              boards, cards, and the activity log. Redis pub/sub enables
              horizontal scaling — multiple server instances broadcast events
              to each other so every connected client stays in sync. The React
              frontend uses optimistic updates for instant feedback, with the
              server as the source of truth.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "FastAPI",
                "WebSockets",
                "Redis Pub/Sub",
                "PostgreSQL",
                "React",
                "TypeScript",
                "Docker",
                "JWT Auth",
              ].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 text-xs font-medium text-surface-600
                    bg-surface-100 rounded-full"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-surface-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-surface-400">
            <Columns3 size={14} />
            <span className="text-xs">SyncBoard</span>
          </div>
          <a
            href="https://github.com/abhi-00g/syncboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-surface-400 hover:text-surface-600 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-surface-800 mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-surface-500 leading-relaxed">{description}</p>
    </motion.div>
  );
}
