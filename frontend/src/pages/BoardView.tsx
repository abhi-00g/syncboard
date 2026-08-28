import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  Plus,
  MessageSquare,
  Calendar,
  UserPlus,
  Wifi,
  WifiOff,
  Activity,
  LogOut,
} from "lucide-react";
import {
  getBoardDetail,
  createCard,
  moveCard,
  addBoardMember,
  ApiError,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import CardDetailModal from "../components/CardDetailModal";
import ActivitySidebar from "../components/ActivitySidebar";
import type { BoardDetail, CardBrief, WSEvent, BoardMember } from "../types";

// ──────────────────────────────────────────────
// Draggable Card
// ──────────────────────────────────────────────

function DraggableCard({
  card,
  onClick,
}: {
  card: CardBrief;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `card-${card.id}`,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onClick();
      }}
      className="bg-white rounded-lg p-3 shadow-sm border border-surface-200
        cursor-grab active:cursor-grabbing hover:border-brand-300
        hover:shadow-md transition-shadow"
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
              <MessageSquare size={12} /> {card.comment_count}
            </span>
          )}
          {card.label_count > 0 && (
            <div className="flex gap-1">
              {Array.from({ length: Math.min(card.label_count, 3) }).map(
                (_, i) => (
                  <div
                    key={i}
                    className="w-5 h-1.5 rounded-full bg-brand-300"
                  />
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Droppable Column
// ──────────────────────────────────────────────

function DroppableColumn({
  column,
  colIndex,
  children,
}: {
  column: { id: number; name: string; cards: CardBrief[] };
  colIndex: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  const COLUMN_COLORS = [
    "border-t-surface-400",
    "border-t-blue-400",
    "border-t-amber-400",
    "border-t-purple-400",
    "border-t-emerald-400",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: colIndex * 0.05 }}
      className={`flex-shrink-0 w-72 rounded-xl border shadow-sm flex flex-col
        max-h-[calc(100vh-140px)] border-t-2 transition-colors
        ${COLUMN_COLORS[colIndex % COLUMN_COLORS.length]}
        ${
          isOver
            ? "bg-brand-50/60 border-brand-300"
            : "bg-white/60 backdrop-blur-sm border-surface-200/60"
        }`}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-surface-700">
          {column.name}
        </h3>
        <span className="text-xs text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full font-medium">
          {column.cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-3 pb-2 space-y-2 min-h-[80px]"
      >
        {children}
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────
// User / Presence Dropdown
// ──────────────────────────────────────────────

function UserDropdown({
  currentUser,
  members,
  onlineUserIds,
  onLogout,
  isOpen,
  onToggle,
}: {
  currentUser: { id: number; display_name: string; email: string } | null;
  members: BoardMember[];
  onlineUserIds: Set<number>;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onToggle]);

  const onlineMembers = members.filter((m) => onlineUserIds.has(m.user.id));
  const offlineMembers = members.filter((m) => !onlineUserIds.has(m.user.id));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Clickable avatar stack */}
      <button
        onClick={onToggle}
        className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        {members.slice(0, 5).map((member) => {
          const isOnline = onlineUserIds.has(member.user.id);
          return (
            <div key={member.id} className="relative">
              <div
                className={`w-8 h-8 rounded-full text-white flex items-center justify-center
                  text-xs font-semibold border-2 border-white shadow-sm
                  ${
                    isOnline
                      ? "bg-gradient-to-br from-brand-400 to-brand-600"
                      : "bg-surface-300"
                  }`}
              >
                {member.user.display_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              {isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
              )}
            </div>
          );
        })}
        {members.length > 5 && (
          <div className="w-8 h-8 rounded-full bg-surface-200 text-surface-500 flex items-center justify-center text-xs font-medium border-2 border-white">
            +{members.length - 5}
          </div>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-64 bg-white rounded-xl shadow-lg border border-surface-200 overflow-hidden z-50"
          >
            {/* Current user */}
            {currentUser && (
              <div className="px-4 py-3 border-b border-surface-100">
                <p className="text-sm font-medium text-surface-800">
                  {currentUser.display_name}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">
                  {currentUser.email}
                </p>
              </div>
            )}

            {/* Online users */}
            {onlineMembers.length > 0 && (
              <div className="px-4 py-2.5">
                <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">
                  Online — {onlineMembers.length}
                </p>
                <div className="space-y-1.5">
                  {onlineMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-[10px] font-semibold">
                          {m.user.display_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 border border-white rounded-full" />
                      </div>
                      <span className="text-xs text-surface-700">
                        {m.user.display_name}
                        {m.user.id === currentUser?.id && (
                          <span className="text-surface-400 ml-1">(you)</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline users */}
            {offlineMembers.length > 0 && (
              <div className="px-4 py-2.5 border-t border-surface-100">
                <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">
                  Offline — {offlineMembers.length}
                </p>
                <div className="space-y-1.5">
                  {offlineMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-surface-200 text-surface-500 flex items-center justify-center text-[10px] font-semibold">
                        {m.user.display_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <span className="text-xs text-surface-400">
                        {m.user.display_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Logout */}
            <div className="border-t border-surface-100">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-surface-500
                  hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Board View
// ──────────────────────────────────────────────

export default function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingCardColumnId, setAddingCardColumnId] = useState<number | null>(
    null
  );
  const [newCardTitle, setNewCardTitle] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [activeCard, setActiveCard] = useState<CardBrief | null>(null);

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Presence state
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

  // Activity sidebar state
  const [showActivity, setShowActivity] = useState(false);
  const [activityRefresh, setActivityRefresh] = useState(0);

  // User dropdown state
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── WebSocket ──
  const handleWSEvent = useCallback((event: WSEvent) => {
    console.log("[WS Event]", event.type, event.data);

    // Presence events
    if (event.type === "presence_state") {
      const userIds = event.data.users as number[];
      setOnlineUserIds(new Set(userIds));
      return;
    }
    if (event.type === "user_joined") {
      const userObj = event.data.user as { id: number };
      setOnlineUserIds((prev) => new Set([...prev, userObj.id]));
      setActivityRefresh((prev) => prev + 1);
      return;
    }
    if (event.type === "user_left") {
      const userObj = event.data.user as { id: number };
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userObj.id);
        return next;
      });
      return;
    }

    // Board events
    setBoard((prev) => {
      if (!prev) return prev;
      switch (event.type) {
        case "card_created": {
          const d = event.data as {
            card_id: number;
            column_id: number;
            title: string;
            position: number;
            version: number;
          };
          const newCard: CardBrief = {
            id: d.card_id,
            column_id: d.column_id,
            title: d.title,
            position: d.position,
            version: d.version,
            assigned_to: null,
            due_date: null,
            label_count: 0,
            comment_count: 0,
          };
          return {
            ...prev,
            columns: prev.columns.map((col) =>
              col.id === d.column_id
                ? { ...col, cards: [...col.cards, newCard] }
                : col
            ),
          };
        }
        case "card_moved": {
          const d = event.data as {
            card_id: number;
            to_column_id: number;
            position: number;
            version: number;
          };
          let movedCard: CardBrief | null = null;
          const withoutCard = prev.columns.map((col) => ({
            ...col,
            cards: col.cards.filter((c) => {
              if (c.id === d.card_id) {
                movedCard = {
                  ...c,
                  column_id: d.to_column_id,
                  position: d.position,
                  version: d.version,
                };
                return false;
              }
              return true;
            }),
          }));
          if (!movedCard) return prev;
          return {
            ...prev,
            columns: withoutCard.map((col) =>
              col.id === d.to_column_id
                ? {
                    ...col,
                    cards: [...col.cards, movedCard!].sort(
                      (a, b) => a.position - b.position
                    ),
                  }
                : col
            ),
          };
        }
        case "card_updated": {
          const d = event.data as {
            card_id: number;
            title: string;
            version: number;
          };
          return {
            ...prev,
            columns: prev.columns.map((col) => ({
              ...col,
              cards: col.cards.map((c) =>
                c.id === d.card_id
                  ? { ...c, title: d.title, version: d.version }
                  : c
              ),
            })),
          };
        }
        case "card_deleted": {
          const d = event.data as { card_id: number };
          return {
            ...prev,
            columns: prev.columns.map((col) => ({
              ...col,
              cards: col.cards.filter((c) => c.id !== d.card_id),
            })),
          };
        }
        default:
          return prev;
      }
    });

    setActivityRefresh((prev) => prev + 1);
  }, []);

  const { isConnected } = useWebSocket({
    boardId: boardId ? parseInt(boardId) : 0,
    token,
    onEvent: handleWSEvent,
    enabled: !!boardId && !!token,
  });

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

  // Drag and Drop
  function handleDragStart(event: DragStartEvent) {
    const cardId = parseInt(String(event.active.id).replace("card-", ""));
    if (!board) return;
    for (const col of board.columns) {
      const card = col.cards.find((c) => c.id === cardId);
      if (card) {
        setActiveCard(card);
        break;
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || !board || !boardId) return;

    const cardId = parseInt(String(active.id).replace("card-", ""));
    const overId = String(over.id);

    let targetColumnId: number | null = null;
    if (overId.startsWith("column-")) {
      targetColumnId = parseInt(overId.replace("column-", ""));
    } else if (overId.startsWith("card-")) {
      const overCardId = parseInt(overId.replace("card-", ""));
      const col = board.columns.find((c) =>
        c.cards.some((card) => card.id === overCardId)
      );
      if (col) targetColumnId = col.id;
    }
    if (targetColumnId === null) return;

    let draggedCard: CardBrief | null = null;
    for (const col of board.columns) {
      const card = col.cards.find((c) => c.id === cardId);
      if (card) {
        draggedCard = card;
        break;
      }
    }
    if (!draggedCard) return;
    if (draggedCard.column_id === targetColumnId) return;

    const targetCol = board.columns.find((c) => c.id === targetColumnId);
    if (!targetCol) return;
    const newPosition = targetCol.cards.length;

    setBoard((prev) => {
      if (!prev) return prev;
      const updatedCard = {
        ...draggedCard!,
        column_id: targetColumnId!,
        position: newPosition,
      };
      return {
        ...prev,
        columns: prev.columns.map((col) => {
          const cardsWithout = col.cards.filter((c) => c.id !== cardId);
          if (col.id === targetColumnId)
            return { ...col, cards: [...cardsWithout, updatedCard] };
          return { ...col, cards: cardsWithout };
        }),
      };
    });

    try {
      await moveCard(
        parseInt(boardId),
        cardId,
        targetColumnId,
        newPosition,
        draggedCard.version
      );
      await loadBoard(parseInt(boardId));
    } catch {
      await loadBoard(parseInt(boardId));
    }
  }

  // Card creation
  async function handleAddCard(columnId: number) {
    if (!newCardTitle.trim() || !boardId) return;
    try {
      const card = await createCard(
        parseInt(boardId),
        columnId,
        newCardTitle.trim()
      );
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
      /* Handle error */
    }
  }

  // Invite with error handling
  async function handleInvite() {
    if (!inviteEmail.trim() || !boardId) return;
    setInviteError("");
    setInviteSuccess("");

    try {
      await addBoardMember(parseInt(boardId), inviteEmail.trim());
      setInviteSuccess(`${inviteEmail.trim()} added to the board`);
      setInviteEmail("");
      loadBoard(parseInt(boardId));
      setTimeout(() => setInviteSuccess(""), 3000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setInviteError("No account found with that email");
        } else if (err.status === 409) {
          setInviteError("This user is already a member of this board");
        } else if (err.status === 403) {
          setInviteError("You don't have permission to invite members");
        } else if (typeof err.detail === "string") {
          setInviteError(err.detail);
        } else {
          setInviteError("Failed to invite member");
        }
      } else {
        setInviteError("Something went wrong — please try again");
      }
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

  function handleLogout() {
    logout();
    navigate("/");
  }

  // Loading / Error states
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
          <Link
            to="/boards"
            className="text-brand-500 hover:text-brand-600 text-sm font-medium"
          >
            ← Back to boards
          </Link>
        </div>
      </div>
    );
  }

  const onlineCount = onlineUserIds.size;

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
              <h1 className="text-lg font-bold text-surface-900">
                {board.name}
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-surface-400">
                  {board.columns.reduce(
                    (sum, col) => sum + col.cards.length,
                    0
                  )}{" "}
                  cards
                </p>
                <span
                  className={`flex items-center gap-1 text-xs ${
                    isConnected ? "text-emerald-500" : "text-surface-400"
                  }`}
                >
                  {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {isConnected ? "Live" : "Connecting..."}
                </span>
                {onlineCount > 0 && (
                  <span className="text-xs text-surface-400">
                    · {onlineCount} online
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Member avatars with dropdown */}
            <UserDropdown
              currentUser={user}
              members={board.members}
              onlineUserIds={onlineUserIds}
              onLogout={handleLogout}
              isOpen={showUserDropdown}
              onToggle={() => setShowUserDropdown(!showUserDropdown)}
            />

            {/* Activity toggle */}
            <button
              onClick={() => setShowActivity(!showActivity)}
              className={`p-2 rounded-lg transition-colors ${
                showActivity
                  ? "text-brand-500 bg-brand-50"
                  : "text-surface-400 hover:text-brand-500 hover:bg-brand-50"
              }`}
              title="Activity feed"
            >
              <Activity size={18} />
            </button>

            {/* Invite toggle */}
            <button
              onClick={() => {
                setShowInvite(!showInvite);
                setInviteError("");
                setInviteSuccess("");
              }}
              className="p-2 rounded-lg text-surface-400 hover:text-brand-500
                hover:bg-brand-50 transition-colors"
            >
              <UserPlus size={18} />
            </button>
          </div>
        </div>

        {/* Invite panel */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-surface-100">
                <div className="flex gap-2">
                  <input
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setInviteError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    placeholder="Enter email to invite..."
                    autoFocus
                    className={`flex-1 px-3 py-2 text-sm border rounded-lg
                      focus:outline-none focus:ring-2 focus:border-transparent transition-colors
                      ${
                        inviteError
                          ? "border-red-300 focus:ring-red-400"
                          : "border-surface-300 focus:ring-brand-500"
                      }`}
                  />
                  <button
                    onClick={handleInvite}
                    className="px-4 py-2 bg-brand-500 text-white text-sm font-medium
                      rounded-lg hover:bg-brand-600 transition-colors"
                  >
                    Invite
                  </button>
                </div>
                {inviteError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-500 mt-1.5 ml-1"
                  >
                    {inviteError}
                  </motion.p>
                )}
                {inviteSuccess && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-emerald-600 mt-1.5 ml-1"
                  >
                    {inviteSuccess}
                  </motion.p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto p-4 sm:p-6">
            <div className="board-columns flex gap-4 h-full min-h-[calc(100vh-120px)]">
              {board.columns.map((column, colIndex) => (
                <DroppableColumn
                  key={column.id}
                  column={column}
                  colIndex={colIndex}
                >
                  {column.cards
                    .sort((a, b) => a.position - b.position)
                    .map((card) => (
                      <DraggableCard
                        key={card.id}
                        card={card}
                        onClick={() => setSelectedCardId(card.id)}
                      />
                    ))}

                  <div className="pt-1">
                    {addingCardColumnId === column.id ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
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
                            className="px-3 py-1.5 bg-brand-500 text-white text-xs font-medium
                              rounded-lg hover:bg-brand-600 transition-colors"
                          >
                            Add card
                          </button>
                          <button
                            onClick={() => {
                              setAddingCardColumnId(null);
                              setNewCardTitle("");
                            }}
                            className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-600
                              transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <button
                        onClick={() => setAddingCardColumnId(column.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-sm
                          text-surface-400 hover:text-brand-500 hover:bg-brand-50
                          rounded-lg transition-colors"
                      >
                        <Plus size={16} /> Add card
                      </button>
                    )}
                  </div>
                </DroppableColumn>
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="bg-white rounded-lg p-3 shadow-xl border-2 border-brand-400 rotate-2 scale-105 cursor-grabbing w-72">
                <p className="text-sm text-surface-800 font-medium">
                  {activeCard.title}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Activity sidebar — receives board for card/column name lookups */}
        <ActivitySidebar
          boardId={parseInt(boardId!)}
          isOpen={showActivity}
          onClose={() => setShowActivity(false)}
          refreshTrigger={activityRefresh}
          board={board}
        />
      </div>

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
