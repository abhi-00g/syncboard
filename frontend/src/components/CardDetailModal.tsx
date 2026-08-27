import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MessageSquare,
  Tag,
  Calendar,
  User,
  Trash2,
  Send,
  AlignLeft,
} from "lucide-react";
import {
  getCardDetail,
  updateCard,
  deleteCard,
  addComment,
  deleteComment,
  getLabels,
  attachLabel,
  removeLabel,
  ApiError,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { CardDetail, Label } from "../types";

interface Props {
  boardId: number;
  cardId: number;
  onClose: () => void;
  onCardUpdated: () => void;
  onCardDeleted: (cardId: number) => void;
}

const LABEL_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-700 border-red-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-100 text-amber-700 border-amber-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
  gray: "bg-gray-100 text-gray-600 border-gray-200",
};

function getLabelStyle(color: string) {
  return LABEL_COLORS[color] || LABEL_COLORS.gray;
}

export default function CardDetailModal({
  boardId,
  cardId,
  onClose,
  onCardUpdated,
  onCardDeleted,
}: Props) {
  const { user } = useAuth();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [boardLabels, setBoardLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [newComment, setNewComment] = useState("");
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    loadCard();
    loadLabels();
  }, [boardId, cardId]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function loadCard() {
    try {
      const data = await getCardDetail(boardId, cardId);
      setCard(data);
      setTitleDraft(data.title);
      setDescDraft(data.description || "");
    } catch {
      onClose();
    } finally {
      setLoading(false);
    }
  }

  async function loadLabels() {
    try {
      const labels = await getLabels(boardId);
      setBoardLabels(labels);
    } catch {
      // Non-critical
    }
  }

  async function handleTitleSave() {
    if (!card || !titleDraft.trim() || titleDraft === card.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await updateCard(boardId, card.id, {
        title: titleDraft.trim(),
        version: card.version,
      });
      await loadCard();
      onCardUpdated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) await loadCard();
    }
    setEditingTitle(false);
  }

  async function handleDescSave() {
    if (!card) return;
    const newDesc = descDraft.trim() || null;
    if (newDesc === (card.description || null)) {
      setEditingDesc(false);
      return;
    }
    try {
      await updateCard(boardId, card.id, {
        description: newDesc || undefined,
        version: card.version,
      });
      await loadCard();
      onCardUpdated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) await loadCard();
    }
    setEditingDesc(false);
  }

  async function handleAddComment() {
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      await addComment(boardId, cardId, newComment.trim());
      setNewComment("");
      await loadCard();
    } catch {
      // Handle error
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await deleteComment(boardId, cardId, commentId);
      await loadCard();
    } catch {
      // Handle error
    }
  }

  async function handleToggleLabel(labelId: number) {
    if (!card) return;
    const isAttached = card.labels.some((cl) => cl.label.id === labelId);
    try {
      if (isAttached) {
        await removeLabel(boardId, cardId, labelId);
      } else {
        await attachLabel(boardId, cardId, labelId);
      }
      await loadCard();
      onCardUpdated();
    } catch {
      // Handle error
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this card? This cannot be undone.")) return;
    try {
      await deleteCard(boardId, cardId);
      onCardDeleted(cardId);
      onClose();
    } catch {
      // Handle error
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-surface-900/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        >
          {loading || !card ? (
            <div className="p-8 text-center text-surface-400">Loading...</div>
          ) : (
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 mr-4">
                  {editingTitle ? (
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTitleSave();
                        if (e.key === "Escape") {
                          setTitleDraft(card.title);
                          setEditingTitle(false);
                        }
                      }}
                      autoFocus
                      className="w-full text-xl font-semibold text-surface-900 bg-surface-50
                        border border-brand-300 rounded-lg px-3 py-1.5
                        focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  ) : (
                    <h2
                      onClick={() => setEditingTitle(true)}
                      className="text-xl font-semibold text-surface-900 cursor-pointer
                        hover:text-brand-600 transition-colors"
                    >
                      {card.title}
                    </h2>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600
                    hover:bg-surface-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Labels */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={14} className="text-surface-400" />
                  <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
                    Labels
                  </span>
                  <button
                    onClick={() => setShowLabelPicker(!showLabelPicker)}
                    className="text-xs text-brand-500 hover:text-brand-600 ml-auto"
                  >
                    {showLabelPicker ? "Done" : "Edit"}
                  </button>
                </div>

                {card.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {card.labels.map((cl) => (
                      <span
                        key={cl.id}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getLabelStyle(cl.label.color)}`}
                      >
                        {cl.label.name}
                      </span>
                    ))}
                  </div>
                )}

                {showLabelPicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="flex flex-wrap gap-2 p-3 bg-surface-50 rounded-lg"
                  >
                    {boardLabels.length === 0 ? (
                      <p className="text-xs text-surface-400">No labels on this board yet</p>
                    ) : (
                      boardLabels.map((label) => {
                        const isAttached = card.labels.some(
                          (cl) => cl.label.id === label.id
                        );
                        return (
                          <button
                            key={label.id}
                            onClick={() => handleToggleLabel(label.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
                              ${getLabelStyle(label.color)}
                              ${isAttached ? "ring-2 ring-brand-400 ring-offset-1" : "opacity-60 hover:opacity-100"}`}
                          >
                            {label.name}
                          </button>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlignLeft size={14} className="text-surface-400" />
                  <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
                    Description
                  </span>
                </div>
                {editingDesc ? (
                  <div>
                    <textarea
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      placeholder="Add a description..."
                      rows={4}
                      autoFocus
                      className="w-full px-3 py-2 text-sm border border-surface-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                        resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleDescSave}
                        className="px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg
                          hover:bg-brand-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setDescDraft(card.description || "");
                          setEditingDesc(false);
                        }}
                        className="px-3 py-1.5 text-xs text-surface-500 hover:text-surface-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingDesc(true)}
                    className="text-sm text-surface-600 bg-surface-50 rounded-lg p-3
                      cursor-pointer hover:bg-surface-100 transition-colors min-h-[60px]"
                  >
                    {card.description || (
                      <span className="text-surface-400 italic">
                        Click to add a description...
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-4 mb-6 text-xs text-surface-400">
                <span className="flex items-center gap-1">
                  <User size={12} />
                  Created by {card.creator.display_name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(card.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-surface-200 my-5" />

              {/* Comments */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={14} className="text-surface-400" />
                  <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
                    Comments ({card.comments.length})
                  </span>
                </div>

                {/* Comment input */}
                <div className="flex gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-full bg-brand-100 text-brand-700
                      flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  >
                    {user?.display_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 relative">
                    <input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) handleAddComment();
                      }}
                      placeholder="Write a comment..."
                      className="w-full px-3 py-2 pr-10 text-sm border border-surface-300 rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-500
                        hover:text-brand-600 disabled:text-surface-300 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>

                {/* Comment list */}
                <div className="space-y-3">
                  {card.comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 group"
                    >
                      <div
                        className="w-8 h-8 rounded-full bg-surface-200 text-surface-600
                          flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      >
                        {comment.user.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-surface-800">
                            {comment.user.display_name}
                          </span>
                          <span className="text-xs text-surface-400">
                            {timeAgo(comment.created_at)}
                          </span>
                          {comment.user.id === user?.id && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 text-surface-400
                                hover:text-red-500 transition-all ml-auto"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-surface-600 mt-0.5">
                          {comment.content}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Delete card */}
              <div className="border-t border-surface-200 mt-6 pt-4">
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-surface-400
                    hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                  Delete card
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
