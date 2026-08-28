/**
 * API client — a thin wrapper around fetch that:
 * 1. Prepends the base URL
 * 2. Attaches the JWT token from localStorage
 * 3. Handles JSON serialization/deserialization
 * 4. Redirects to /login on 401 (expired token)
 *
 * Every API call in the app goes through this client.
 */

const BASE_URL = "/api";

class ApiError extends Error {
  status: number;
  detail: string | Record<string, unknown>;

  constructor(status: number, detail: string | Record<string, unknown>) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 — token expired or invalid
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new ApiError(401, "Session expired");
  }

  // Handle 204 No Content (delete operations)
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.detail || "Something went wrong");
  }

  return data as T;
}

// ──────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  displayName: string
) {
  return request<import("../types").TokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      display_name: displayName,
    }),
  });
}

export async function login(email: string, password: string) {
  // OAuth2 form data format (not JSON) — matches our backend
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, data.detail || "Login failed");
  }
  return data as import("../types").TokenResponse;
}

/**
 * Guest login — creates a temporary guest account and a pre-seeded demo board.
 * No password required. Returns a JWT token and the demo board's ID so the
 * frontend can redirect directly to it.
 */
export async function guestLogin() {
  return request<import("../types").GuestLoginResponse>("/auth/guest", {
    method: "POST",
  });
}

// ──────────────────────────────────────────────
// Boards
// ──────────────────────────────────────────────

export async function getBoards() {
  return request<import("../types").Board[]>("/boards/");
}

export async function createBoard(name: string) {
  return request<import("../types").Board>("/boards/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getBoardDetail(boardId: number) {
  return request<import("../types").BoardDetail>(`/boards/${boardId}`);
}

export async function updateBoard(boardId: number, name: string) {
  return request<import("../types").Board>(`/boards/${boardId}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteBoard(boardId: number) {
  return request<void>(`/boards/${boardId}`, { method: "DELETE" });
}

export async function addBoardMember(boardId: number, email: string) {
  return request<import("../types").BoardMember>(`/boards/${boardId}/members`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// ──────────────────────────────────────────────
// Columns
// ──────────────────────────────────────────────

export async function createColumn(boardId: number, name: string) {
  return request<import("../types").Column>(`/boards/${boardId}/columns/`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateColumn(
  boardId: number,
  columnId: number,
  data: { name?: string; position?: number }
) {
  return request<import("../types").Column>(
    `/boards/${boardId}/columns/${columnId}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function deleteColumn(boardId: number, columnId: number) {
  return request<void>(`/boards/${boardId}/columns/${columnId}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// Cards
// ──────────────────────────────────────────────

export async function createCard(
  boardId: number,
  columnId: number,
  title: string
) {
  return request<import("../types").CardBrief>(`/boards/${boardId}/cards/`, {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, title }),
  });
}

export async function getCardDetail(boardId: number, cardId: number) {
  return request<import("../types").CardDetail>(
    `/boards/${boardId}/cards/${cardId}`
  );
}

export async function updateCard(
  boardId: number,
  cardId: number,
  data: {
    title?: string;
    description?: string;
    assigned_to?: number | null;
    due_date?: string | null;
    version: number;
  }
) {
  return request<import("../types").CardBrief>(
    `/boards/${boardId}/cards/${cardId}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
}

export async function moveCard(
  boardId: number,
  cardId: number,
  columnId: number,
  position: number,
  version: number
) {
  return request<import("../types").CardBrief>(
    `/boards/${boardId}/cards/${cardId}/move`,
    {
      method: "PUT",
      body: JSON.stringify({
        column_id: columnId,
        position,
        version,
      }),
    }
  );
}

export async function deleteCard(boardId: number, cardId: number) {
  return request<void>(`/boards/${boardId}/cards/${cardId}`, {
    method: "DELETE",
  });
}

// ──────────────────────────────────────────────
// Comments
// ──────────────────────────────────────────────

export async function addComment(
  boardId: number,
  cardId: number,
  content: string
) {
  return request<import("../types").Comment>(
    `/boards/${boardId}/cards/${cardId}/comments`,
    { method: "POST", body: JSON.stringify({ content }) }
  );
}

export async function deleteComment(
  boardId: number,
  cardId: number,
  commentId: number
) {
  return request<void>(
    `/boards/${boardId}/cards/${cardId}/comments/${commentId}`,
    { method: "DELETE" }
  );
}

// ──────────────────────────────────────────────
// Labels
// ──────────────────────────────────────────────

export async function getLabels(boardId: number) {
  return request<import("../types").Label[]>(`/boards/${boardId}/labels/`);
}

export async function createLabel(
  boardId: number,
  name: string,
  color: string
) {
  return request<import("../types").Label>(`/boards/${boardId}/labels/`, {
    method: "POST",
    body: JSON.stringify({ name, color }),
  });
}

export async function deleteLabel(boardId: number, labelId: number) {
  return request<void>(`/boards/${boardId}/labels/${labelId}`, {
    method: "DELETE",
  });
}

export async function attachLabel(
  boardId: number,
  cardId: number,
  labelId: number
) {
  return request<void>(
    `/boards/${boardId}/cards/${cardId}/labels/${labelId}`,
    { method: "POST" }
  );
}

export async function removeLabel(
  boardId: number,
  cardId: number,
  labelId: number
) {
  return request<void>(
    `/boards/${boardId}/cards/${cardId}/labels/${labelId}`,
    { method: "DELETE" }
  );
}

// ──────────────────────────────────────────────
// Activity
// ──────────────────────────────────────────────

export async function getActivity(boardId: number, limit = 50, offset = 0) {
  return request<import("../types").ActivityEvent[]>(
    `/boards/${boardId}/activity/?limit=${limit}&offset=${offset}`
  );
}

export { ApiError };
