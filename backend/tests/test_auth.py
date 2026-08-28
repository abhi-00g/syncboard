"""Tests for /api/auth endpoints."""

import pytest
from httpx import AsyncClient


class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "new@test.com",
            "password": "Str0ng!Pass",
            "display_name": "New User",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == "new@test.com"
        assert data["user"]["display_name"] == "New User"

    async def test_register_duplicate_email(self, client: AsyncClient):
        payload = {
            "email": "dup@test.com",
            "password": "Str0ng!Pass",
            "display_name": "User One",
        }
        resp1 = await client.post("/api/auth/register", json=payload)
        assert resp1.status_code == 201

        resp2 = await client.post("/api/auth/register", json=payload)
        assert resp2.status_code == 409

    async def test_register_weak_password(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "weak@test.com",
            "password": "short",
            "display_name": "Weak User",
        })
        assert resp.status_code == 422

    async def test_register_missing_display_name(self, client: AsyncClient):
        resp = await client.post("/api/auth/register", json={
            "email": "no-name@test.com",
            "password": "Str0ng!Pass",
            "display_name": "",
        })
        assert resp.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient):
        # Register first
        await client.post("/api/auth/register", json={
            "email": "login@test.com",
            "password": "Str0ng!Pass",
            "display_name": "Login User",
        })
        # Login with form data (OAuth2 format)
        resp = await client.post("/api/auth/login", data={
            "username": "login@test.com",
            "password": "Str0ng!Pass",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == "login@test.com"

    async def test_login_wrong_password(self, client: AsyncClient):
        await client.post("/api/auth/register", json={
            "email": "wrong@test.com",
            "password": "Str0ng!Pass",
            "display_name": "Wrong",
        })
        resp = await client.post("/api/auth/login", data={
            "username": "wrong@test.com",
            "password": "WrongPassword1!",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_email(self, client: AsyncClient):
        resp = await client.post("/api/auth/login", data={
            "username": "ghost@test.com",
            "password": "Str0ng!Pass",
        })
        assert resp.status_code == 401


class TestGuestLogin:
    async def test_guest_login_creates_user_and_board(self, client: AsyncClient):
        resp = await client.post("/api/auth/guest")
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert "board_id" in data
        assert data["user"]["email"].endswith("@syncboard.demo")

    async def test_guest_login_shared_board(self, client: AsyncClient):
        """Two guest logins should return the same board_id (shared demo)."""
        resp1 = await client.post("/api/auth/guest")
        resp2 = await client.post("/api/auth/guest")
        assert resp1.json()["board_id"] == resp2.json()["board_id"]

    async def test_guest_can_access_board(self, client: AsyncClient):
        guest = await client.post("/api/auth/guest")
        data = guest.json()
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        board = await client.get(
            f"/api/boards/{data['board_id']}", headers=headers
        )
        assert board.status_code == 200
        assert board.json()["name"] == "SyncBoard Demo"
