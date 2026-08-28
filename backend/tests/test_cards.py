"""Tests for /api/boards/{id}/cards endpoints.

Covers the full card lifecycle and, most importantly, optimistic
concurrency control — the version conflict tests verify that two
simultaneous edits don't silently overwrite each other.
"""

import pytest
from httpx import AsyncClient


async def _create_card(client, headers, board_id, column_id, title="Test Card"):
    """Helper: create a card and return its response dict."""
    resp = await client.post(
        f"/api/boards/{board_id}/cards/",
        json={"column_id": column_id, "title": title},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


class TestCardCRUD:
    async def test_create_card(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        col_id = board["columns"][0]["id"]
        card = await _create_card(client, headers, board["id"], col_id)
        assert card["title"] == "Test Card"
        assert card["column_id"] == col_id
        assert card["version"] == 1

    async def test_get_card_detail(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        col_id = board["columns"][0]["id"]
        card = await _create_card(client, headers, board["id"], col_id)

        resp = await client.get(
            f"/api/boards/{board['id']}/cards/{card['id']}",
            headers=headers,
        )
        assert resp.status_code == 200
        detail = resp.json()
        assert detail["title"] == "Test Card"
        assert "comments" in detail
        assert "labels" in detail

    async def test_update_card_title(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        col_id = board["columns"][0]["id"]
        card = await _create_card(client, headers, board["id"], col_id)

        resp = await client.put(
            f"/api/boards/{board['id']}/cards/{card['id']}",
            json={"title": "Updated Title", "version": card["version"]},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    async def test_delete_card(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        col_id = board["columns"][0]["id"]
        card = await _create_card(client, headers, board["id"], col_id)

        resp = await client.delete(
            f"/api/boards/{board['id']}/cards/{card['id']}",
            headers=headers,
        )
        assert resp.status_code == 204

        # Verify it's gone
        resp = await client.get(
            f"/api/boards/{board['id']}/cards/{card['id']}",
            headers=headers,
        )
        assert resp.status_code == 404


class TestCardMove:
    async def test_move_card_to_another_column(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        from_col = board["columns"][0]["id"]
        to_col = board["columns"][1]["id"]
        card = await _create_card(client, headers, board["id"], from_col)

        resp = await client.put(
            f"/api/boards/{board['id']}/cards/{card['id']}/move",
            json={
                "column_id": to_col,
                "position": 0,
                "version": card["version"],
            },
            headers=headers,
        )
        assert resp.status_code == 200
        moved = resp.json()
        assert moved["column_id"] == to_col

    async def test_move_preserves_other_cards(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        col_a = board["columns"][0]["id"]
        col_b = board["columns"][1]["id"]

        card1 = await _create_card(client, headers, board["id"], col_a, "Card 1")
        card2 = await _create_card(client, headers, board["id"], col_a, "Card 2")

        # Move card1 to col_b
        await client.put(
            f"/api/boards/{board['id']}/cards/{card1['id']}/move",
            json={"column_id": col_b, "position": 0, "version": card1["version"]},
            headers=headers,
        )

        # Verify card2 still in col_a
        detail = await client.get(f"/api/boards/{board['id']}", headers=headers)
        col_a_data = next(c for c in detail.json()["columns"] if c["id"] == col_a)
        col_b_data = next(c for c in detail.json()["columns"] if c["id"] == col_b)
        assert len(col_a_data["cards"]) == 1
        assert col_a_data["cards"][0]["title"] == "Card 2"
        assert len(col_b_data["cards"]) == 1
        assert col_b_data["cards"][0]["title"] == "Card 1"


class TestConcurrencyControl:
    """Optimistic concurrency: version numbers prevent lost updates.

    If User A and User B both load a card at version 1, and User A
    saves (bumping to version 2), User B's save with version 1 must
    be rejected with 409 Conflict.
    """

    async def test_version_conflict_on_update(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        col_id = board["columns"][0]["id"]
        card = await _create_card(client, headers, board["id"], col_id)
        assert card["version"] == 1

        # First update succeeds — version 1 → 2
        resp1 = await client.put(
            f"/api/boards/{board['id']}/cards/{card['id']}",
            json={"title": "User A edit", "version": 1},
            headers=headers,
        )
        assert resp1.status_code == 200
        assert resp1.json()["version"] == 2

        # Second update with stale version 1 → 409
        resp2 = await client.put(
            f"/api/boards/{board['id']}/cards/{card['id']}",
            json={"title": "User B edit", "version": 1},
            headers=headers,
        )
        assert resp2.status_code == 409

    async def test_version_conflict_on_move(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        col_a = board["columns"][0]["id"]
        col_b = board["columns"][1]["id"]
        col_c = board["columns"][2]["id"]
        card = await _create_card(client, headers, board["id"], col_a)

        # Move A→B succeeds with version 1
        resp1 = await client.put(
            f"/api/boards/{board['id']}/cards/{card['id']}/move",
            json={"column_id": col_b, "position": 0, "version": 1},
            headers=headers,
        )
        assert resp1.status_code == 200

        # Move A→C with stale version 1 → 409
        resp2 = await client.put(
            f"/api/boards/{board['id']}/cards/{card['id']}/move",
            json={"column_id": col_c, "position": 0, "version": 1},
            headers=headers,
        )
        assert resp2.status_code == 409


class TestCardAuth:
    async def test_non_member_cannot_create_card(self, client: AsyncClient, board_setup):
        _, board = board_setup
        # Register outsider
        resp = await client.post("/api/auth/register", json={
            "email": "outsider@test.com",
            "password": "Str0ng!Pass",
            "display_name": "Outsider",
        })
        outsider_headers = {
            "Authorization": f"Bearer {resp.json()['access_token']}"
        }
        col_id = board["columns"][0]["id"]
        resp = await client.post(
            f"/api/boards/{board['id']}/cards/",
            json={"column_id": col_id, "title": "Sneak"},
            headers=outsider_headers,
        )
        assert resp.status_code == 403
