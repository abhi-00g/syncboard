import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Plus,
  MessageSquare,
  Calendar,
  Users,
  MoreHorizontal,
  UserPlus,
} from "lucide-react";
import { getBoardDetail, createCard, addBoardMember } from "../api/client";
import { useAuth } from "../context/AuthContext";
import CardDetailModal from "../components/CardDetailModal";
import type { BoardDetail, CardBrief } from "../types";

const COLUMN_COLORS = [
  "border-t-surface-400",
  "border-t-blue-400",
  "border-t-amber-400",
  "border-t-purple-400",
  "border-t-emerald-400",
];

export default function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingCardColumnId, setAddingCardColumnId] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

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
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === columnId ? { ...col, cards: [...col.cards, card] } : col
          ),
        };
      });
      setNewCardTitle("");
      setAddingCardColumnId(null);
    } catch {
      // Handle error
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !boardId) return;
    try {
      await addBoardMember(parseInt(boardId), inviteEmail.trim());
      setInviteEmail("");
      setShowInvite(false);
      loadBoard(parseInt(boardId));
    } catch {
      // Handle error
    }
  }

  function handleCardUpdated() {
    if (boardId) loadBoard(parseInt(boardId));
  }

  function handleCardDeleted(cardId: number) {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.filter((c) => c.id !== cardId),
        })),
      };
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-surface-400">Loading board...</p>
        </motion.div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-surface-500 mb-4">{error || "Board not found"}</p>
          <Link to="/boards" className="text-brand-500 hover:text-brand-600 text-sm font-medium">
            ← Back to boards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-100 via-surface-50 to-brand-50/30 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-surface-200 px-4 sm:px-6 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/boards"
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600
                hover:bg-surface-100 transition-colors"
            >
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-surface-900">{board.name}</h1>
              <p className="text-xs text-surface-400">{board.columns.reduce((sum, col) => sum + col.cards.length, 0)} cards</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Member avatars */}
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {board.members.slice(0, 5).map((member) => (
                  <div
                    key={member.id}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600
                      text-white flex items-center justify-center text-xs font-semibold
                      border-2 border-white shadow-sm"
                    title={member.user.display_name}
                  >
                    {member.user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                ))}
              </div>
              {board.members.length > 5 && (
                <span className="ml-1 text-xs text-surface-400">+{board.members.length - 5}</span>
              )}
            </div>

            <button
              onClick={() => setShowInvite(!showInvite)}
              className="p-2 rounded-lg text-surface-400 hover:text-brand-500
                hover:bg-brand-50 transition-colors"
              title="Invite member"
            >
              <UserPlus size={18} />
            </button>
          </div>
        </div>

        {/* Invite form */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="Enter email to invite..."
                  autoFocus
                  className="flex-1 px-3 py-2 text-sm border border-surface-300 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <button onClick={handleInvite} className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors">
                  Invite
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6">
        <div className="board-columns flex gap-4 h-full min-h-[calc(100vh-120px)]">
          {board.columns.map((column, colIndex) => (
            <motion.div
              key={column.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: colIndex * 0.05 }}
              className={`flex-shrink-0 w-72 bg-white/60 backdrop-blur-sm rounded-xl border border-surface-200/60
                shadow-sm flex flex-col max-h-[calc(100vh-140px)] border-t-2 ${COLUMN_COLORS[colIndex % COLUMN_COLORS.length]}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <h3 className="text-sm font-semibold text-surface-700">
                  {column.name}
                </h3>
                <span className="text-xs text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full font-medium">
                  {column.cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2 min-h-0">
                <AnimatePresence>
                  {column.cards
                    .sort((a, b) => a.position - b.position)
                    .map((card) => (
                      <CardItem
                        key={card.id}
                        card={card}
                        onClick={() => setSelectedCardId(card.id)}
                      />
                    ))}
                </AnimatePresence>
              </div>

              {/* Add card */}
              <div className="px-3 pb-3">
                {addingCardColumnId === column.id ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                  >
                    <textarea
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddCard(column.id);
                        }
                        if (e.key === "Escape") {
                          setAddingCardColumnId(null);
                          setNewCardTitle("");
                        }
                      }}
                      placeholder="Enter a title..."
                      autoFocus
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-surface-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                        resize-none bg-white"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleAddCard(column.id)}
                        className="px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg
                          hover:bg-brand-600 transition-colors"
                      >
                        Add card
                      </button>
                      <button
                        onClick={() => {
                          setAddingCardColumnId(null);
                          setNewCardTitle("");
                        }}
                        className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setAddingCardColumnId(column.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-surface-400
                      hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                  >
                    <Plus size={16} />
                    Add card
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Card detail modal */}
      <AnimatePresence>
        {selectedCardId !== null && boardId && (
          <CardDetailModal
            boardId={parseInt(boardId)}
            cardId={selectedCardId}
            onClose={() => setSelectedCardId(null)}
            onCardUpdated={handleCardUpdated}
            onCardDeleted={handleCardDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────
// Card component
// ──────────────────────────────────────────────

function CardItem({
  card,
  onClick,
}: {
  card: CardBrief;
  onClick: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
      onClick={onClick}
      className="bg-white rounded-lg p-3 shadow-sm border border-surface-200
        cursor-pointer transition-colors group"
    >
      <p className="text-sm text-surface-800 font-medium leading-snug">
        {card.title}
      </p>

      {(card.due_date || card.comment_count > 0 || card.label_count > 0) && (
        <div className="flex items-center gap-3 mt-2.5 text-surface-400">
          {card.due_date && (
            <span className="flex items-center gap-1 text-xs">
              <Calendar size={12} />
              {new Date(card.due_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {card.comment_count > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <MessageSquare size={12} />
              {card.comment_count}
            </span>
          )}
          {card.label_count > 0 && (
            <div className="flex gap-1">
              {Array.from({ length: Math.min(card.label_count, 3) }).map((_, i) => (
                <div key={i} className="w-5 h-1.5 rounded-full bg-brand-300" />
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
