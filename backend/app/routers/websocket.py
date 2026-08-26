import asyncio
import json
import traceback

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models.user import User
from app.realtime.events import USER_JOINED, USER_LEFT, broadcast_event
from app.realtime.manager import manager
from app.realtime.pubsub import redis_service
from app.services.board import check_board_membership

router = APIRouter(tags=["websocket"])


async def authenticate_websocket(token: str) -> int | None:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        return user_id if isinstance(user_id, int) else None
    except InvalidTokenError:
        return None


async def get_user_info(user_id: int) -> dict | None:
    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            return {
                "id": user.id,
                "display_name": user.display_name,
                "email": user.email,
            }
    return None


async def verify_board_access(board_id: int, user_id: int) -> bool:
    async with async_session() as db:
        membership = await check_board_membership(db, board_id, user_id)
        return membership is not None


@router.websocket("/ws/boards/{board_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    board_id: int,
    token: str = Query(...),
):
    user_info = None  # Initialize so finally block can reference it safely

    # Step 1: Authenticate
    print(f"[WS] Step 1: Authenticating token for board {board_id}")
    user_id = await authenticate_websocket(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Step 2: Authorize
    print(f"[WS] Step 2: Checking board access for user {user_id}")
    has_access = await verify_board_access(board_id, user_id)
    if not has_access:
        await websocket.close(code=4003, reason="Not a board member")
        return

    # Step 3: Accept and register
    print(f"[WS] Step 3: Accepting WebSocket for user {user_id} on board {board_id}")
    await manager.connect(board_id, user_id, websocket)

    try:
        # Step 4: Subscribe to Redis
        print(f"[WS] Step 4: Subscribing to Redis channel for board {board_id}")
        await redis_service.subscribe_board(board_id)

        # Step 5: Set presence
        print(f"[WS] Step 5: Setting presence")
        await redis_service.set_presence(board_id, user_id)

        # Step 6: Get user info and presence list
        print(f"[WS] Step 6: Getting user info and presence list")
        user_info = await get_user_info(user_id)
        present_users = await redis_service.get_present_users(board_id)
        print(f"[WS] Step 6 done: user_info={user_info}, present_users={present_users}")

        # Step 7: Send presence state to connecting user
        print(f"[WS] Step 7: Sending presence state")
        await websocket.send_json({
            "type": "presence_state",
            "data": {"users": present_users},
        })

        # Step 8: Broadcast user_joined to others
        print(f"[WS] Step 8: Broadcasting user_joined")
        await broadcast_event(
            board_id=board_id,
            event_type=USER_JOINED,
            data={"user": user_info},
            actor_id=user_id,
        )

        print(f"[WS] Setup complete. Entering heartbeat loop.")

        # Step 9: Listen for heartbeats
        while True:
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=45.0,
                )
                message = json.loads(raw)

                if message.get("type") == "heartbeat":
                    await redis_service.refresh_presence(board_id, user_id)
                    await websocket.send_json({"type": "heartbeat_ack"})

            except asyncio.TimeoutError:
                await websocket.close(code=1000, reason="Heartbeat timeout")
                break

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: user {user_id} from board {board_id}")
    except Exception as e:
        print(f"[WS] ERROR for user {user_id} on board {board_id}: {e}")
        traceback.print_exc()
    finally:
        print(f"[WS] Cleanup: user {user_id} from board {board_id}")
        was_last = manager.disconnect(board_id, user_id)
        await redis_service.remove_presence(board_id, user_id)

        if was_last:
            await redis_service.unsubscribe_board(board_id)

        if user_info:
            await broadcast_event(
                board_id=board_id,
                event_type=USER_LEFT,
                data={"user": user_info},
                actor_id=user_id,
            )
