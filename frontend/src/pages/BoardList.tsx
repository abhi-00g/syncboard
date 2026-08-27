import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      // Error handled by API client (401 → redirect)
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
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-surface-900">SyncBoard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-surface-500">
              {user?.display_name}
            </span>
            <button
              onClick={logout}
              className="text-sm text-surface-500 hover:text-surface-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-surface-900">
            Your boards
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg
              hover:bg-brand-600 transition-colors"
          >
            New board
          </button>
        </div>

        {/* Create board form */}
        {showCreate && (
          <form
            onSubmit={handleCreateBoard}
            className="mb-6 bg-white border border-surface-200 rounded-lg p-4 flex gap-3"
          >
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name (e.g., Sprint 14)"
              autoFocus
              className="flex-1 px-3 py-2 border border-surface-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg
                hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewBoardName("");
              }}
              className="px-4 py-2 text-sm text-surface-500 hover:text-surface-700 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Board grid */}
        {loading ? (
          <div className="text-center py-12 text-surface-400">Loading boards...</div>
        ) : boards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-surface-500 mb-2">No boards yet</p>
            <p className="text-sm text-surface-400">
              Create your first board to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/boards/${board.id}`}
                className="bg-white border border-surface-200 rounded-lg p-5
                  hover:border-brand-300 hover:shadow-sm transition-all group"
              >
                <h3 className="font-semibold text-surface-900 group-hover:text-brand-600 transition-colors">
                  {board.name}
                </h3>
                <p className="text-xs text-surface-400 mt-2">
                  Updated {new Date(board.updated_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
