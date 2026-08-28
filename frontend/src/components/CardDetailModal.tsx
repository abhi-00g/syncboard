import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Tag, Calendar, User, Trash2, Send, AlignLeft } from "lucide-react";
import { getCardDetail, updateCard, deleteCard, addComment, deleteComment, getLabels, attachLabel, removeLabel, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { CardDetail, Label } from "../types";

interface Props {
  boardId: number; cardId: number; onClose: () => void;
  onCardUpdated: () => void; onCardDeleted: (cardId: number) => void;
}

const LABEL_COLORS: Record<string, string> = {
  red: "bg-red-500/15 text-red-400 border-red-500/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  pink: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  gray: "bg-surface-200 text-surface-500 border-surface-200",
};
function getLabelStyle(color: string) { return LABEL_COLORS[color] || LABEL_COLORS.gray; }

export default function CardDetailModal({ boardId, cardId, onClose, onCardUpdated, onCardDeleted }: Props) {
  const { user } = useAuth();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [boardLabels, setBoardLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [newComment, setNewComment] = useState("");
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => { loadCard(); loadLabels(); }, [boardId, cardId]);
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function loadCard() {
    try { const data = await getCardDetail(boardId, cardId); setCard(data); setTitleDraft(data.title); setDescDraft(data.description || ""); }
    catch { onClose(); } finally { setLoading(false); }
  }
  async function loadLabels() { try { setBoardLabels(await getLabels(boardId)); } catch {} }

  async function handleTitleSave() {
    if (!card || !titleDraft.trim() || titleDraft === card.title) { setEditingTitle(false); return; }
    try { await updateCard(boardId, card.id, { title: titleDraft.trim(), version: card.version }); await loadCard(); onCardUpdated(); }
    catch (err) { if (err instanceof ApiError && err.status === 409) await loadCard(); }
    setEditingTitle(false);
  }
  async function handleDescSave() {
    if (!card) return;
    const newDesc = descDraft.trim() || null;
    if (newDesc === (card.description || null)) { setEditingDesc(false); return; }
    try { await updateCard(boardId, card.id, { description: newDesc || undefined, version: card.version }); await loadCard(); onCardUpdated(); }
    catch (err) { if (err instanceof ApiError && err.status === 409) await loadCard(); }
    setEditingDesc(false);
  }
  async function handleAddComment() {
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try { await addComment(boardId, cardId, newComment.trim()); setNewComment(""); await loadCard(); }
    catch {} finally { setSubmittingComment(false); }
  }
  async function handleDeleteComment(commentId: number) { try { await deleteComment(boardId, cardId, commentId); await loadCard(); } catch {} }
  async function handleToggleLabel(labelId: number) {
    if (!card) return;
    const isAttached = card.labels.some((cl) => cl.label.id === labelId);
    try { if (isAttached) await removeLabel(boardId, cardId, labelId); else await attachLabel(boardId, cardId, labelId); await loadCard(); onCardUpdated(); } catch {}
  }
  async function handleDelete() {
    if (!confirm("Delete this card?")) return;
    try { await deleteCard(boardId, cardId); onCardDeleted(cardId); onClose(); } catch {}
  }
  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now"; if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ type: "spring", duration: 0.35, bounce: 0.12 }}
          className="relative bg-surface-300 border border-surface-200 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          {loading || !card ? (
            <div className="p-8 text-center text-surface-400">Loading...</div>
          ) : (
            <div className="p-6">
              {/* Title */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 mr-4">
                  {editingTitle ? (
                    <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={(e) => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") { setTitleDraft(card.title); setEditingTitle(false); } }}
                      autoFocus className="w-full text-lg font-semibold text-surface-900 bg-surface-200/50 border border-brand-500/40 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  ) : (
                    <h2 onClick={() => setEditingTitle(true)}
                      className="text-lg font-semibold text-surface-900 cursor-pointer hover:text-brand-500 transition-colors">
                      {card.title}
                    </h2>
                  )}
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-200 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Labels */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={12} className="text-surface-400" />
                  <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Labels</span>
                  <button onClick={() => setShowLabelPicker(!showLabelPicker)}
                    className="text-[11px] text-brand-500 hover:text-brand-600 ml-auto">{showLabelPicker ? "Done" : "Edit"}</button>
                </div>
                {card.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {card.labels.map((cl) => (
                      <span key={cl.id} className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getLabelStyle(cl.label.color)}`}>{cl.label.name}</span>
                    ))}
                  </div>
                )}
                {showLabelPicker && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="flex flex-wrap gap-2 p-3 bg-surface-200/50 rounded-lg">
                    {boardLabels.length === 0 ? <p className="text-xs text-surface-400">No labels on this board</p> : boardLabels.map((label) => {
                      const isAttached = card.labels.some((cl) => cl.label.id === label.id);
                      return (
                        <button key={label.id} onClick={() => handleToggleLabel(label.id)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${getLabelStyle(label.color)}
                            ${isAttached ? "ring-1 ring-brand-500 ring-offset-1 ring-offset-surface-300" : "opacity-50 hover:opacity-100"}`}>{label.name}</button>
                      );
                    })}
                  </motion.div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlignLeft size={12} className="text-surface-400" />
                  <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Description</span>
                </div>
                {editingDesc ? (
                  <div>
                    <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)}
                      placeholder="Add a description..." rows={4} autoFocus
                      className="w-full px-3 py-2 text-sm bg-surface-200/50 border border-surface-200 rounded-lg text-surface-700
                        focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 resize-none" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleDescSave} className="px-3 py-1.5 bg-brand-500 text-surface-0 text-xs font-medium rounded-lg hover:bg-brand-400 transition-colors">Save</button>
                      <button onClick={() => { setDescDraft(card.description || ""); setEditingDesc(false); }} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-600">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setEditingDesc(true)}
                    className="text-sm text-surface-500 bg-surface-200/30 rounded-lg p-3 cursor-pointer hover:bg-surface-200/50 transition-colors min-h-[60px]">
                    {card.description || <span className="text-surface-400 italic">Click to add a description...</span>}
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 mb-6 text-xs text-surface-400">
                <span className="flex items-center gap-1"><User size={11} /> {card.creator.display_name}</span>
                <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(card.created_at).toLocaleDateString()}</span>
              </div>

              <div className="border-t border-surface-200 my-5" />

              {/* Comments */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={12} className="text-surface-400" />
                  <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">Comments ({card.comments.length})</span>
                </div>
                <div className="flex gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-brand-500/15 text-brand-500 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                    {user?.display_name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 relative">
                    <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleAddComment(); }}
                      placeholder="Write a comment..."
                      className="w-full px-3 py-2 pr-9 text-sm bg-surface-200/50 border border-surface-200 rounded-lg text-surface-700 placeholder-surface-400
                        focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50" />
                    <button onClick={handleAddComment} disabled={!newComment.trim() || submittingComment}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-400 disabled:text-surface-400 transition-colors">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {card.comments.map((comment) => (
                    <motion.div key={comment.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 group">
                      <div className="w-7 h-7 rounded-full bg-surface-200 text-surface-500 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                        {comment.user.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-surface-700">{comment.user.display_name}</span>
                          <span className="text-[10px] text-surface-400">{timeAgo(comment.created_at)}</span>
                          {comment.user.id === user?.id && (
                            <button onClick={() => handleDeleteComment(comment.id)}
                              className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-400 transition-all ml-auto">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-surface-500 mt-0.5">{comment.content}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="border-t border-surface-200 mt-6 pt-4">
                <button onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-red-400 transition-colors">
                  <Trash2 size={12} /> Delete card
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
