import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  X,
  ArrowRight,
  Plus,
  Edit3,
  Trash2,
  MessageSquare,
  UserPlus,
  Tag,
} from "lucide-react";
import { getActivity } from "../api/client";
import type { ActivityEvent, BoardDetail } from "../types";

interface Props {
  boardId: number;
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger: number;
  /** Board data for looking up card titles and column names */
  board: BoardDetail | null;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  card_created: <Plus size={12} />,
  card_moved: <ArrowRight size={12} />,
  card_updated: <Edit3 size={12} />,
  card_deleted: <Trash2 size={12} />,
  comment_added: <MessageSquare size={12} />,
  comment_deleted: <MessageSquare size={12} />,
  member_added: <UserPlus size={12} />,
  member_removed: <UserPlus size={12} />,
  label_attached: <Tag size={12} />,
  label_removed: <Tag size={12} />,
  board_updated: <Edit3 size={12} />,
};

// Fallback descriptions when we can't parse the detail JSON
const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  card_created: "created a card",
  card_moved: "moved a card",
  card_updated: "updated a card",
  card_deleted: "deleted a card",
  comment_added: "added a comment",
  comment_deleted: "deleted a comment",
  member_added: "added a member",
  member_removed: "removed a member",
  label_attached: "attached a label",
  label_removed: "removed a label",
  board_updated: "updated the board",
  column_created: "created a column",
  column_updated: "updated a column",
  column_deleted: "deleted a column",
};

/**
 * Turns a raw activity event into a readable sentence like:
 *   moved 'Update resume' from To Do to In Progress
 *
 * The backend stores event data dicts as the `detail` field (raw JSON).
 * We parse that JSON, then look up card titles and column names from
 * the live board data. If a card was deleted or renamed since the event,
 * we gracefully fall back to a generic description.
 */
function formatDetail(event: ActivityEvent, board: BoardDetail | null): string {
  const detail = event.detail;

  // If detail is already a readable sentence (not JSON), use it directly
  if (detail && !detail.startsWith("{") && !detail.startsWith("[")) {
    return detail;
  }

  // Try to parse the JSON and build a rich description
  if (board && detail) {
    try {
      const data = JSON.parse(detail);

      // Helpers to look up names from the current board state
      const colName = (id: number) =>
        board.columns.find((c) => c.id === id)?.name;
      const cardTitle = (id: number): string | null => {
        for (const col of board.columns) {
          const card = col.cards.find((c) => c.id === id);
          if (card) return card.title;
        }
        return null;
      };
      // Truncate long card titles for the feed
      const shortTitle = (title: string) =>
        title.length > 30 ? title.slice(0, 30) + "…" : title;

      switch (event.event_type) {
        case "card_moved": {
          const to = colName(data.to_column_id || data.column_id);
          const title = cardTitle(data.card_id);
          const label = title ? `'${shortTitle(title)}'` : "a card";
          return to ? `moved ${label} to ${to}` : `moved ${label}`;
        }
        case "card_created": {
          // detail may contain title directly, or we look it up
          const title =
            data.title || cardTitle(data.card_id || data.id);
          return title
            ? `created '${shortTitle(title)}'`
            : "created a card";
        }
        case "card_updated": {
          const title = cardTitle(data.card_id || data.id);
          return title
            ? `updated '${shortTitle(title)}'`
            : "updated a card";
        }
        case "card_deleted": {
          // Card is gone so we can't look it up — check if title is in the data
          return data.title
            ? `deleted '${shortTitle(data.title)}'`
            : "deleted a card";
        }
        case "comment_added": {
          const title = cardTitle(data.card_id);
          return title
            ? `commented on '${shortTitle(title)}'`
            : "added a comment";
        }
        case "comment_deleted": {
          const title = cardTitle(data.card_id);
          return title
            ? `removed a comment from '${shortTitle(title)}'`
            : "deleted a comment";
        }
        case "member_added": {
          return data.email
            ? `invited ${data.email}`
            : "added a member";
        }
        case "label_attached": {
          const title = cardTitle(data.card_id);
          return title
            ? `labeled '${shortTitle(title)}'`
            : "attached a label";
        }
        case "label_removed": {
          const title = cardTitle(data.card_id);
          return title
            ? `removed a label from '${shortTitle(title)}'`
            : "removed a label";
        }
      }
    } catch {
      // JSON parse failed — fall through to fallback
    }
  }

  return (
    FALLBACK_DESCRIPTIONS[event.event_type] ||
    event.event_type.replace(/_/g, " ")
  );
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

export default function ActivitySidebar({
  boardId,
  isOpen,
  onClose,
  refreshTrigger,
  board,
}: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) loadActivity();
  }, [isOpen, boardId, refreshTrigger]);

  async function loadActivity() {
    if (events.length === 0) setLoading(true);
    try {
      const data = await getActivity(boardId);
      setEvents(data);
    } catch {
      /* Non-critical */
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
          className="border-l border-surface-200 bg-white flex flex-col overflow-hidden flex-shrink-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-surface-500" />
              <span className="text-sm font-semibold text-surface-700">
                Activity
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-surface-400 hover:text-surface-600
                hover:bg-surface-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-surface-400">Loading activity...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center">
                <Activity
                  size={28}
                  className="mx-auto text-surface-200 mb-3"
                />
                <p className="text-sm text-surface-400">No activity yet</p>
                <p className="text-xs text-surface-300 mt-1">
                  Actions on this board will appear here
                </p>
              </div>
            ) : (
              <div className="py-1">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 px-4 py-2.5 hover:bg-surface-50
                      transition-colors"
                  >
                    <div
                      className="w-6 h-6 rounded-full bg-surface-100 text-surface-500
                        flex items-center justify-center flex-shrink-0 mt-0.5"
                    >
                      {EVENT_ICONS[event.event_type] || (
                        <Activity size={12} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-600 leading-relaxed">
                        <span className="font-medium text-surface-800">
                          {event.user.display_name}
                        </span>{" "}
                        {formatDetail(event, board)}
                      </p>
                      <p className="text-[11px] text-surface-400 mt-0.5">
                        {timeAgo(event.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
