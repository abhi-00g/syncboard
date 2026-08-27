import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getBoardDetail, createCard } from "../api/client";
import type { BoardDetail } from "../types";

export default function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingCardColumnId, setAddingCardColumnId] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  useEffect(() => {
    if (boardId) loadBoard(parseInt(boardId));
  }, [boardId]);

  async function loadBoard(id: number) {
    setLoading(true);
    setError("");
    try {
      const data = await getBoardDetail(id);
      setBoard(data);
    } catch {
      setError("Failed to load board");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCard(columnId: number) {
    if (!newCardTitle.trim() || !boardId) return;

    try {
      const card = await createCard(parseInt(boardId), columnId, newCardTitle.trim());
      // Add card to the column in local state
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === columnId
              ? { ...col, cards: [...col.cards, card] }
              : col
          ),
        };
      });
      setNewCardTitle("");
      setAddingCardColumnId(null);
    } catch {
      // Handle error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <p className="text-surface-400">Loading board...</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-surface-500 mb-4">{error || "Board not found"}</p>
          <Link to="/boards" className="text-brand-500 hover:text-brand-600 text-sm">
            Back to boards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link
          to="/boards"
          className="text-surface-400 hover:text-surface-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-surface-900">{board.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          {board.members.map((member) => (
            <div
              key={member.id}
              className="w-8 h-8 rounded-full bg-brand-100 text-brand-700
                flex items-center justify-center text-xs font-semibold"
              title={member.user.display_name}
            >
              {member.user.display_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
          ))}
        </div>
      </header>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
        <div className="board-columns flex gap-4 h-full">
          {board.columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 bg-surface-200/50 rounded-xl p-3 flex flex-col max-h-[calc(100vh-120px)]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-surface-700">
                  {column.name}
                </h3>
                <span className="text-xs text-surface-400 bg-surface-200 px-1.5 py-0.5 rounded">
                  {column.cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {column.cards
                  .sort((a, b) => a.position - b.position)
                  .map((card) => (
                    <div
                      key={card.id}
                      className="bg-white rounded-lg p-3 shadow-sm border border-surface-200
                        hover:border-brand-300 hover:shadow transition-all cursor-pointer"
                    >
                      <p className="text-sm text-surface-800 font-medium">
                        {card.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {card.due_date && (
                          <span className="text-xs text-surface-400">
                            {new Date(card.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {card.comment_count > 0 && (
                          <span className="text-xs text-surface-400">
                            💬 {card.comment_count}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Add card */}
              {addingCardColumnId === column.id ? (
                <div className="mt-2">
                  <input
                    type="text"
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCard(column.id);
                      if (e.key === "Escape") {
                        setAddingCardColumnId(null);
                        setNewCardTitle("");
                      }
                    }}
                    placeholder="Card title"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-surface-300 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAddCard(column.id)}
                      className="px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg
                        hover:bg-brand-600 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingCardColumnId(null);
                        setNewCardTitle("");
                      }}
                      className="px-3 py-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingCardColumnId(column.id)}
                  className="mt-2 w-full py-2 text-sm text-surface-400 hover:text-surface-600
                    hover:bg-surface-200 rounded-lg transition-colors"
                >
                  + Add card
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
