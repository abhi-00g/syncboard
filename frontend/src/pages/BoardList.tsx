import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LayoutDashboard, LogOut, X, Columns3 } from "lucide-react";
import { getBoards, createBoard } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Board } from "../types";

export default function BoardList() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [creating, setCreating] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    try {
      const data = await getBoards();
      setBoards(data);
    } catch {
      // Handled by API client
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    setCreating(true);
    try {
      const board = await createBoard(newBoardName.trim());
      setBoards([board, ...boards]);
      setNewBoardName("");
      setShowCreate(false);
      navigate(`/boards/${board.id}`);
    } catch {
      // Handle error
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-brand-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-surface-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg
              flex items-center justify-center shadow-sm">
              <Columns3 size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-surface-900">SyncBoard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600
                text-white flex items-center justify-center text-xs font-semibold shadow-sm">
                {user?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <span className="text-sm font-medium text-surface-700 hidden sm:inline">
                {user?.display_name}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-surface-400 hover:text-surface-600
                hover:bg-surface-100 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h2 className="text-2xl font-bold text-surface-900">Your boards</h2>
            <p className="text-sm text-surface-400 mt-1">
              {boards.length} board{boards.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 text-white text-sm
              font-medium rounded-xl hover:bg-brand-600 shadow-sm shadow-brand-500/20
              hover:shadow-md hover:shadow-brand-500/30 transition-all active:scale-[0.98]"
          >
            <Plus size={18} />
            New board
          </button>
        </motion.div>

        {/* Create board modal */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <form
                onSubmit={handleCreateBoard}
                className="bg-white border border-surface-200 rounded-xl p-4 shadow-sm
                  flex gap-3 items-center"
              >
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Enter board name..."
                  autoFocus
                  className="flex-1 px-4 py-2.5 border border-surface-300 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                    text-sm"
                />
                <button
                  type="submit"
                  disabled={creating || !newBoardName.trim()}
                  className="px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-xl
                    hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setNewBoardName(""); }}
                  className="p-2 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Board grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
                <div className="h-5 bg-surface-100 rounded w-2/3 mb-3" />
                <div className="h-3 bg-surface-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : boards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard size={28} className="text-surface-300" />
            </div>
            <p className="text-surface-500 font-medium mb-1">No boards yet</p>
            <p className="text-sm text-surface-400">
              Create your first board to start collaborating
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board, i) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to={`/boards/${board.id}`}
                  className="block bg-white border border-surface-200 rounded-xl p-5
                    hover:border-brand-300 hover:shadow-md hover:shadow-brand-500/5
                    transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-surface-900 group-hover:text-brand-600 transition-colors">
                      {board.name}
                    </h3>
                    <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-500
                      flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                      <Columns3 size={16} />
                    </div>
                  </div>
                  <p className="text-xs text-surface-400 mt-3">
                    Updated {new Date(board.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
