import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, DragOverlay, closestCorners, PointerSensor,
  useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft, Plus, MessageSquare, Calendar, UserPlus,
  Wifi, WifiOff, Activity, LogOut,
} from "lucide-react";
import {
  getBoardDetail, createCard, moveCard, addBoardMember, ApiError,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import CardDetailModal from "../components/CardDetailModal";
import ActivitySidebar from "../components/ActivitySidebar";
import type { BoardDetail, CardBrief, WSEvent, BoardMember } from "../types";

// ── Draggable Card ──

function DraggableCard({ card, onClick }: { card: CardBrief; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`, data: { type: "card", card },
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={() => { if (!isDragging) onClick(); }}
      className="bg-surface-300 rounded-lg p-3 border border-surface-200
        cursor-grab active:cursor-grabbing hover:border-brand-500/30 transition-colors">
      <p className="text-sm text-surface-800 font-medium leading-snug">{card.title}</p>
      {(card.due_date || card.comment_count > 0 || card.label_count > 0) && (
        <div className="flex items-center gap-3 mt-2 text-surface-400">
          {card.due_date && (
            <span className="flex items-center gap-1 text-[11px]">
              <Calendar size={11} />
              {new Date(card.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {card.comment_count > 0 && (
            <span className="flex items-center gap-1 text-[11px]"><MessageSquare size={11} /> {card.comment_count}</span>
          )}
          {card.label_count > 0 && (
            <div className="flex gap-1">
              {Array.from({ length: Math.min(card.label_count, 3) }).map((_, i) => (
                <div key={i} className="w-4 h-1 rounded-full bg-brand-500/40" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Droppable Column ──

function DroppableColumn({ column, colIndex, children }: {
  column: { id: number; name: string; cards: CardBrief[] }; colIndex: number; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${column.id}`, data: { type: "column", columnId: column.id } });
  const COLORS = ["border-t-zinc-500", "border-t-blue-500", "border-t-amber-500", "border-t-purple-500", "border-t-emerald-500"];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: colIndex * 0.04 }}
      className={`flex-shrink-0 w-72 rounded-lg border border-surface-200 flex flex-col
        max-h-[calc(100vh-140px)] border-t-2 transition-colors
        ${COLORS[colIndex % COLORS.length]}
        ${isOver ? "bg-brand-500/5 border-brand-500/20" : "bg-surface-50"}`}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h3 className="text-xs font-semibold text-surface-600 uppercase tracking-wider">{column.name}</h3>
        <span className="text-[11px] text-surface-400 bg-surface-200 px-1.5 py-0.5 rounded font-medium">{column.cards.length}</span>
      </div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto px-2.5 pb-2 space-y-1.5 min-h-[80px]">{children}</div>
    </motion.div>
  );
}

// ── User Dropdown ──

function UserDropdown({ currentUser, members, onlineUserIds, onLogout, isOpen, onToggle }: {
  currentUser: { id: number; display_name: string; email: string } | null;
  members: BoardMember[]; onlineUserIds: Set<number>;
  onLogout: () => void; isOpen: boolean; onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onToggle(); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onToggle]);

  const online = members.filter((m) => onlineUserIds.has(m.user.id));
  const offline = members.filter((m) => !onlineUserIds.has(m.user.id));

  return (
    <div className="relative" ref={ref}>
      <button onClick={onToggle} className="flex -space-x-1.5 cursor-pointer hover:opacity-80 transition-opacity">
        {members.slice(0, 5).map((member) => {
          const isOnline = onlineUserIds.has(member.user.id);
          return (
            <div key={member.id} className="relative">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border border-surface-100
                ${isOnline ? "bg-surface-300 text-brand-500" : "bg-surface-200 text-surface-400"}`}>
                {member.user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 border-2 border-surface-100 rounded-full" />}
            </div>
          );
        })}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }} transition={{ duration: 0.12 }}
            className="absolute right-0 top-10 w-56 bg-surface-300 border border-surface-200 rounded-lg overflow-hidden z-50">
            {currentUser && (
              <div className="px-3 py-2.5 border-b border-surface-200">
                <p className="text-xs font-medium text-surface-800">{currentUser.display_name}</p>
                <p className="text-[10px] text-surface-400 mt-0.5">{currentUser.email}</p>
              </div>
            )}
            {online.length > 0 && (
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Online — {online.length}</p>
                {online.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="relative">
                      <div className="w-5 h-5 rounded-full bg-surface-200 text-brand-500 flex items-center justify-center text-[9px] font-semibold">
                        {m.user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 border border-surface-300 rounded-full" />
                    </div>
                    <span className="text-[11px] text-surface-600">{m.user.display_name}{m.user.id === currentUser?.id && <span className="text-surface-400 ml-1">(you)</span>}</span>
                  </div>
                ))}
              </div>
            )}
            {offline.length > 0 && (
              <div className="px-3 py-2 border-t border-surface-200">
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Offline — {offline.length}</p>
                {offline.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="w-5 h-5 rounded-full bg-surface-200 text-surface-400 flex items-center justify-center text-[9px] font-semibold">
                      {m.user.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <span className="text-[11px] text-surface-400">{m.user.display_name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-surface-200">
              <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-surface-400 hover:text-red-400 hover:bg-red-500/5 transition-colors">
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Board View ──

export default function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingCardColumnId, setAddingCardColumnId] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [activeCard, setActiveCard] = useState<CardBrief | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [showActivity, setShowActivity] = useState(false);
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleWSEvent = useCallback((event: WSEvent) => {
    if (event.type === "presence_state") { setOnlineUserIds(new Set(event.data.users as number[])); return; }
    if (event.type === "user_joined") { const u = event.data.user as { id: number }; setOnlineUserIds((p) => new Set([...p, u.id])); setActivityRefresh((p) => p + 1); return; }
    if (event.type === "user_left") { const u = event.data.user as { id: number }; setOnlineUserIds((p) => { const n = new Set(p); n.delete(u.id); return n; }); return; }

    setBoard((prev) => {
      if (!prev) return prev;
      switch (event.type) {
        case "card_created": {
          const d = event.data as { card_id: number; column_id: number; title: string; position: number; version: number };
          const nc: CardBrief = { id: d.card_id, column_id: d.column_id, title: d.title, position: d.position, version: d.version, assigned_to: null, due_date: null, label_count: 0, comment_count: 0 };
          return { ...prev, columns: prev.columns.map((col) => col.id === d.column_id ? { ...col, cards: [...col.cards, nc] } : col) };
        }
        case "card_moved": {
          const d = event.data as { card_id: number; to_column_id: number; position: number; version: number };
          let mc: CardBrief | null = null;
          const wo = prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => { if (c.id === d.card_id) { mc = { ...c, column_id: d.to_column_id, position: d.position, version: d.version }; return false; } return true; }) }));
          if (!mc) return prev;
          return { ...prev, columns: wo.map((col) => col.id === d.to_column_id ? { ...col, cards: [...col.cards, mc!].sort((a, b) => a.position - b.position) } : col) };
        }
        case "card_updated": {
          const d = event.data as { card_id: number; title: string; version: number };
          return { ...prev, columns: prev.columns.map((col) => ({ ...col, cards: col.cards.map((c) => c.id === d.card_id ? { ...c, title: d.title, version: d.version } : c) })) };
        }
        case "card_deleted": {
          const d = event.data as { card_id: number };
          return { ...prev, columns: prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== d.card_id) })) };
        }
        default: return prev;
      }
    });
    setActivityRefresh((p) => p + 1);
  }, []);

  const { isConnected } = useWebSocket({ boardId: boardId ? parseInt(boardId) : 0, token, onEvent: handleWSEvent, enabled: !!boardId && !!token });

  useEffect(() => { if (boardId) loadBoard(parseInt(boardId)); }, [boardId]);
  async function loadBoard(id: number) { setLoading(true); setError(""); try { setBoard(await getBoardDetail(id)); } catch { setError("Failed to load board"); } finally { setLoading(false); } }

  function handleDragStart(event: DragStartEvent) {
    const cardId = parseInt(String(event.active.id).replace("card-", ""));
    if (!board) return;
    for (const col of board.columns) { const c = col.cards.find((c) => c.id === cardId); if (c) { setActiveCard(c); break; } }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || !board || !boardId) return;
    const cardId = parseInt(String(active.id).replace("card-", ""));
    const overId = String(over.id);
    let targetColumnId: number | null = null;
    if (overId.startsWith("column-")) targetColumnId = parseInt(overId.replace("column-", ""));
    else if (overId.startsWith("card-")) { const oci = parseInt(overId.replace("card-", "")); const col = board.columns.find((c) => c.cards.some((card) => card.id === oci)); if (col) targetColumnId = col.id; }
    if (targetColumnId === null) return;
    let draggedCard: CardBrief | null = null;
    for (const col of board.columns) { const c = col.cards.find((c) => c.id === cardId); if (c) { draggedCard = c; break; } }
    if (!draggedCard || draggedCard.column_id === targetColumnId) return;
    const targetCol = board.columns.find((c) => c.id === targetColumnId);
    if (!targetCol) return;
    const newPosition = targetCol.cards.length;
    setBoard((prev) => { if (!prev) return prev; const uc = { ...draggedCard!, column_id: targetColumnId!, position: newPosition }; return { ...prev, columns: prev.columns.map((col) => { const cw = col.cards.filter((c) => c.id !== cardId); if (col.id === targetColumnId) return { ...col, cards: [...cw, uc] }; return { ...col, cards: cw }; }) }; });
    try { await moveCard(parseInt(boardId), cardId, targetColumnId, newPosition, draggedCard.version); await loadBoard(parseInt(boardId)); } catch { await loadBoard(parseInt(boardId)); }
  }

  async function handleAddCard(columnId: number) {
    if (!newCardTitle.trim() || !boardId) return;
    try { const card = await createCard(parseInt(boardId), columnId, newCardTitle.trim()); setBoard((prev) => { if (!prev) return prev; return { ...prev, columns: prev.columns.map((col) => col.id === columnId ? { ...col, cards: [...col.cards, card] } : col) }; }); setNewCardTitle(""); setAddingCardColumnId(null); } catch {}
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !boardId) return;
    setInviteError(""); setInviteSuccess("");
    try { await addBoardMember(parseInt(boardId), inviteEmail.trim()); setInviteSuccess(`${inviteEmail.trim()} added`); setInviteEmail(""); loadBoard(parseInt(boardId)); setTimeout(() => setInviteSuccess(""), 3000); }
    catch (err) { if (err instanceof ApiError) { if (err.status === 404) setInviteError("No account with that email"); else if (err.status === 409) setInviteError("Already a member"); else if (err.status === 403) setInviteError("No permission"); else setInviteError(typeof err.detail === "string" ? err.detail : "Failed"); } else setInviteError("Something went wrong"); }
  }

  function handleCardUpdated() { if (boardId) loadBoard(parseInt(boardId)); }
  function handleCardDeleted(cardId: number) { setBoard((prev) => { if (!prev) return prev; return { ...prev, columns: prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })) }; }); }
  function handleLogout() { logout(); navigate("/"); }

  if (loading) return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-surface-400">Loading board...</p>
      </div>
    </div>
  );

  if (error || !board) return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-surface-500 mb-4 text-sm">{error || "Board not found"}</p>
        <Link to="/boards" className="text-brand-500 hover:text-brand-400 text-sm">← Back to boards</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      {/* Header */}
      <header className="bg-surface-100 border-b border-surface-200 px-4 sm:px-6 py-2.5 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/boards" className="p-1 rounded text-surface-400 hover:text-surface-600 transition-colors">
              <ChevronLeft size={18} />
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-surface-900">{board.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-surface-400">{board.columns.reduce((s, c) => s + c.cards.length, 0)} cards</p>
                <span className={`flex items-center gap-1 text-[11px] ${isConnected ? "text-emerald-400" : "text-surface-400"}`}>
                  {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {isConnected ? "Live" : "Connecting..."}
                </span>
                {onlineUserIds.size > 0 && <span className="text-[11px] text-surface-400">· {onlineUserIds.size} online</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <UserDropdown currentUser={user} members={board.members} onlineUserIds={onlineUserIds}
              onLogout={handleLogout} isOpen={showUserDropdown} onToggle={() => setShowUserDropdown(!showUserDropdown)} />
            <button onClick={() => setShowActivity(!showActivity)}
              className={`p-1.5 rounded-lg transition-colors ${showActivity ? "text-brand-500 bg-brand-500/10" : "text-surface-400 hover:text-brand-500"}`} title="Activity">
              <Activity size={16} />
            </button>
            <button onClick={() => { setShowInvite(!showInvite); setInviteError(""); setInviteSuccess(""); }}
              className="p-1.5 rounded-lg text-surface-400 hover:text-brand-500 transition-colors">
              <UserPlus size={16} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showInvite && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2.5 pt-2.5 border-t border-surface-200">
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()} placeholder="Email to invite..." autoFocus
                    className={`flex-1 px-3 py-2 text-sm bg-surface-200/50 border rounded-lg text-surface-800 placeholder-surface-400
                      focus:outline-none focus:ring-2 focus:border-transparent transition-colors
                      ${inviteError ? "border-red-500/40 focus:ring-red-500/20" : "border-surface-200 focus:ring-brand-500/30"}`} />
                  <button onClick={handleInvite} className="px-3 py-2 bg-brand-500 text-surface-0 text-sm font-medium rounded-lg hover:bg-brand-400 transition-colors">Invite</button>
                </div>
                {inviteError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-red-400 mt-1.5 ml-1">{inviteError}</motion.p>}
                {inviteSuccess && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-emerald-400 mt-1.5 ml-1">{inviteSuccess}</motion.p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-x-auto p-4 sm:p-5">
            <div className="flex gap-3 h-full min-h-[calc(100vh-100px)]">
              {board.columns.map((column, colIndex) => (
                <DroppableColumn key={column.id} column={column} colIndex={colIndex}>
                  {column.cards.sort((a, b) => a.position - b.position).map((card) => (
                    <DraggableCard key={card.id} card={card} onClick={() => setSelectedCardId(card.id)} />
                  ))}
                  <div className="pt-1">
                    {addingCardColumnId === column.id ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <textarea value={newCardTitle} onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddCard(column.id); } if (e.key === "Escape") { setAddingCardColumnId(null); setNewCardTitle(""); } }}
                          placeholder="Enter a title..." autoFocus rows={2}
                          className="w-full px-3 py-2 text-sm bg-surface-200/50 border border-surface-200 rounded-lg text-surface-800 placeholder-surface-400
                            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 resize-none" />
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => handleAddCard(column.id)} className="px-3 py-1.5 bg-brand-500 text-surface-0 text-xs font-medium rounded-lg hover:bg-brand-400 transition-colors">Add</button>
                          <button onClick={() => { setAddingCardColumnId(null); setNewCardTitle(""); }} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-600">Cancel</button>
                        </div>
                      </motion.div>
                    ) : (
                      <button onClick={() => setAddingCardColumnId(column.id)}
                        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-surface-400 hover:text-brand-500 rounded-lg transition-colors">
                        <Plus size={14} /> Add card
                      </button>
                    )}
                  </div>
                </DroppableColumn>
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="bg-surface-300 rounded-lg p-3 border-2 border-brand-500 rotate-1 scale-105 cursor-grabbing w-72">
                <p className="text-sm text-surface-800 font-medium">{activeCard.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        <ActivitySidebar boardId={parseInt(boardId!)} isOpen={showActivity}
          onClose={() => setShowActivity(false)} refreshTrigger={activityRefresh} board={board} />
      </div>

      <AnimatePresence>
        {selectedCardId !== null && boardId && (
          <CardDetailModal boardId={parseInt(boardId)} cardId={selectedCardId}
            onClose={() => setSelectedCardId(null)} onCardUpdated={handleCardUpdated} onCardDeleted={handleCardDeleted} />
        )}
      </AnimatePresence>
    </div>
  );
}
