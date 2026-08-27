// These interfaces match the backend Pydantic response schemas exactly.
// When the API returns data, TypeScript knows the shape at compile time.

export interface User {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Board {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export interface BoardMember {
  id: number;
  user: User;
  role: string;
  joined_at: string;
}

export interface CardBrief {
  id: number;
  column_id: number;
  title: string;
  position: number;
  version: number;
  assigned_to: number | null;
  due_date: string | null;
  label_count: number;
  comment_count: number;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  cards: CardBrief[];
  created_at: string;
}

export interface BoardDetail {
  id: number;
  name: string;
  owner_id: number;
  columns: Column[];
  members: BoardMember[];
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: number;
  board_id: number;
  name: string;
  color: string;
}

export interface CardLabel {
  id: number;
  label: Label;
}

export interface Comment {
  id: number;
  card_id: number;
  user: User;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CardDetail {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  position: number;
  version: number;
  created_by: number;
  assigned_to: number | null;
  due_date: string | null;
  creator: User;
  assignee: User | null;
  labels: CardLabel[];
  comments: Comment[];
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: number;
  board_id: number;
  user: User;
  event_type: string;
  entity_type: string;
  entity_id: number;
  detail: string;
  created_at: string;
}

// WebSocket event types
export interface WSEvent {
  type: string;
  board_id?: number;
  actor_id?: number;
  data: Record<string, unknown>;
  timestamp?: string;
}
