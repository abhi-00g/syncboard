import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, X, ArrowRight, Plus, Edit3, Trash2,
  MessageSquare, UserPlus, Tag,
} from "lucide-react";
import { getActivity } from "../api/client";
import type { ActivityEvent, BoardDetail } from "../types";

interface Props {
  boardId: number;
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger: number;
  board: BoardDetail | null;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  card_created: <Plus size={12} />, card_moved: <ArrowRight size={12} />,
  card_updated: <Edit3 size={12} />, card_deleted: <Trash2 size={12} />,
  comment_added: <MessageSquare size={12} />, comment_deleted: <MessageSquare size={12} />,
  member_added: <UserPlus size={12} />, label_attached: <Tag size={12} />,
  label_removed: <Tag size={12} />,
};

const FALLBACK: Record<string, string> = {
  card_created: "created a card", card_moved: "moved a card",
  card_updated: "updated a card", card_deleted: "deleted a card",
  comment_added: "added a comment", comment_deleted: "deleted a comment",
  member_added: "added a member", label_attached: "attached a label",
  label_removed: "removed a label", board_updated: "updated the board",
};

function formatDetail(event: ActivityEvent, board: BoardDetail | null): string {
  const detail = event.detail;
  if (detail && !detail.startsWith("{") && !detail.startsWith("[")) return detail;
  if (board && detail) {
    try {
      const data = JSON.parse(detail);
      const colName = (id: number) => board.columns.find((c) => c.id === id)?.name;
      const cardTitle = (id: number): string | null => {
        for (const col of board.columns) { const c = col.cards.find((c) => c.id === id); if (c) return c.title; }
        return null;
      };
      const short = (t: string) => t.length > 30 ? t.slice(0, 30) + "…" : t;
      switch (event.event_type) {
        case "card_moved": {
          const to = colName(data.to_column_id || data.column_id);
          const title = cardTitle(data.card_id);
          const label = title ? `'${short(title)}'` : "a card";
          return to ? `moved ${label} to ${to}` : `moved ${label}`;
        }
        case "card_created": {
          const title = data.title || cardTitle(data.card_id || data.id);
          return title ? `created '${short(title)}'` : "created a card";
        }
        case "card_updated": {
          const title = cardTitle(data.card_id || data.id);
          return title ? `updated '${short(title)}'` : "updated a card";
        }
        case "card_deleted": return data.title ? `deleted '${short(data.title)}'` : "deleted a card";
        case "comment_added": {
          const title = cardTitle(data.card_id);
          return title ? `commented on '${short(title)}'` : "added a comment";
        }
        case "member_added": return data.email ? `invited ${data.email}` : "added a member";
      }
    } catch { /* fall through */ }
  }
  return FALLBACK[event.event_type] || event.event_type.replace(/_/g, " ");
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActivitySidebar({ boardId, isOpen, onClose, refreshTrigger, board }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (isOpen) loadActivity(); }, [isOpen, boardId, refreshTrigger]);

  async function loadActivity() {
    if (events.length === 0) setLoading(true);
    try { const data = await getActivity(boardId); setEvents(data); }
    catch { /* */ }
    finally { setLoading(false); }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }} transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
          className="border-l border-surface-200 bg-surface-50 flex flex-col overflow-hidden flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-surface-400" />
              <span className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Activity</span>
            </div>
            <button onClick={onClose} className="p-1 rounded text-surface-400 hover:text-surface-600 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex flex-col items-center gap-2">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-surface-400">Loading...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center">
                <Activity size={24} className="mx-auto text-surface-300 mb-3" />
                <p className="text-sm text-surface-400">No activity yet</p>
              </div>
            ) : (
              <div className="py-1">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-2.5 px-4 py-2.5 hover:bg-surface-200/30 transition-colors">
                    <div className="w-5 h-5 rounded bg-surface-200 text-surface-400
                      flex items-center justify-center flex-shrink-0 mt-0.5">
                      {EVENT_ICONS[event.event_type] || <Activity size={10} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-500 leading-relaxed">
                        <span className="font-medium text-surface-700">{event.user.display_name}</span>{" "}
                        {formatDetail(event, board)}
                      </p>
                      <p className="text-[10px] text-surface-400 mt-0.5">{timeAgo(event.created_at)}</p>
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
