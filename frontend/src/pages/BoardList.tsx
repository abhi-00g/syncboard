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

  useEffect(() => { loadBoards(); }, []);

  async function loadBoards() {
    try { const data = await getBoards(); setBoards(data); }
    catch { /* Handled by API client */ }
    finally { setLoading(false); }
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
    } catch { /* Handle error */ }
    finally { setCreating(false); }
  }

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Header */}
      <header className="border-b border-surface-200 sticky top-0 z-40 bg-surface-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <Columns3 size={14} className="text-surface-0" />
            </div>
            <span className="text-base font-bold text-surface-900">SyncBoard</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-surface-300 text-surface-500
                flex items-center justify-center text-xs font-semibold">
                {user?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <span className="text-sm text-surface-500 hidden sm:inline">
                {user?.display_name}
              </span>
            </div>
            <button onClick={logout}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600
                hover:bg-surface-200 transition-colors" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-surface-900">Your boards</h2>
            <p className="text-xs text-surface-400 mt-1">
              {boards.length} board{boards.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-surface-0
              text-sm font-medium rounded-lg hover:bg-brand-400 transition-colors">
            <Plus size={16} /> New board
          </button>
        </motion.div>

        {/* Create board inline */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <form onSubmit={handleCreateBoard}
                className="bg-surface-300 border border-surface-200 rounded-lg p-3
                  flex gap-3 items-center">
                <input type="text" value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Board name..." autoFocus
                  className="flex-1 px-3 py-2 bg-surface-200/50 border border-surface-200 rounded-lg
                    text-surface-800 placeholder-surface-400 text-sm
                    focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50" />
                <button type="submit" disabled={creating || !newBoardName.trim()}
                  className="px-4 py-2 bg-brand-500 text-surface-0 text-sm font-medium rounded-lg
                    hover:bg-brand-400 disabled:opacity-50 transition-colors">
                  {creating ? "Creating..." : "Create"}
                </button>
                <button type="button"
                  onClick={() => { setShowCreate(false); setNewBoardName(""); }}
                  className="p-1.5 text-surface-400 hover:text-surface-600 transition-colors">
                  <X size={16} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Board grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-300 rounded-lg border border-surface-200 p-5 animate-pulse">
                <div className="h-4 bg-surface-200 rounded w-2/3 mb-3" />
                <div className="h-3 bg-surface-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : boards.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-14 h-14 bg-surface-200 rounded-xl flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard size={24} className="text-surface-400" />
            </div>
            <p className="text-surface-500 font-medium mb-1">No boards yet</p>
            <p className="text-sm text-surface-400">Create your first board to start collaborating</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {boards.map((board, i) => (
              <motion.div key={board.id} initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link to={`/boards/${board.id}`}
                  className="block bg-surface-300 border border-surface-200 rounded-lg p-4
                    hover:border-brand-500/30 transition-all group">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-surface-800 text-sm
                      group-hover:text-brand-500 transition-colors">
                      {board.name}
                    </h3>
                    <div className="w-7 h-7 rounded bg-brand-50 text-brand-500
                      flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                      <Columns3 size={14} />
                    </div>
                  </div>
                  <p className="text-[11px] text-surface-400 mt-3">
                    Updated {new Date(board.updated_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
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
