"""Tests for /api/boards endpoints."""

import pytest
from httpx import AsyncClient


class TestBoardCRUD:
    async def test_create_board(self, client: AsyncClient, authed):
        headers, user = authed
        resp = await client.post(
            "/api/boards/", json={"name": "My Board"}, headers=headers
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Board"
        assert data["owner_id"] == user["id"]

    async def test_list_boards_empty(self, client: AsyncClient, authed):
        headers, _ = authed
        resp = await client.get("/api/boards/", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_boards_after_create(self, client: AsyncClient, authed):
        headers, _ = authed
        await client.post(
            "/api/boards/", json={"name": "Board A"}, headers=headers
        )
        await client.post(
            "/api/boards/", json={"name": "Board B"}, headers=headers
        )
        resp = await client.get("/api/boards/", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_get_board_detail_has_columns(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        assert board["name"] == "Sprint 1"
        assert len(board["columns"]) == 5  # Default: Backlog, To Do, In Progress, In Review, Done
        assert len(board["members"]) == 1  # Owner

    async def test_board_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/boards/")
        assert resp.status_code == 401


class TestBoardMembers:
    async def test_add_member(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        # Register second user
        resp = await client.post("/api/auth/register", json={
            "email": "bob@test.com",
            "password": "Str0ng!Pass",
            "display_name": "Bob",
        })
        bob_token = resp.json()["access_token"]

        # Add Bob as member
        resp = await client.post(
            f"/api/boards/{board['id']}/members",
            json={"email": "bob@test.com"},
            headers=headers,
        )
        assert resp.status_code in (200, 201)

        # Bob can now access the board
        bob_headers = {"Authorization": f"Bearer {bob_token}"}
        resp = await client.get(
            f"/api/boards/{board['id']}", headers=bob_headers
        )
        assert resp.status_code == 200
        assert len(resp.json()["members"]) == 2

    async def test_add_nonexistent_member(self, client: AsyncClient, board_setup):
        headers, board = board_setup
        resp = await client.post(
            f"/api/boards/{board['id']}/members",
            json={"email": "nobody@test.com"},
            headers=headers,
        )
        assert resp.status_code == 400

    async def test_non_member_cannot_access(self, client: AsyncClient, board_setup):
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
        resp = await client.get(
            f"/api/boards/{board['id']}", headers=outsider_headers
        )
        assert resp.status_code == 403
