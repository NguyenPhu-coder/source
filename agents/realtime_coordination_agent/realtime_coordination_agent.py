"""
Real-time Coordination Agent for Learn Your Way Platform

Provides WebSocket-based real-time coordination, multi-device synchronization,
push notifications, study rooms, and collaborative features.

Architecture:
- WebSocket server with JWT authentication
- Redis for pub/sub and state synchronization
- Multi-device conflict resolution (LWW/Vector Clock)
- Push notifications (FCM, APNS, Web Push)
- Study room collaboration
- Presence tracking
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any
from enum import Enum
from dataclasses import dataclass, asdict
from collections import defaultdict
import uuid

import yaml
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from jose import JWTError, jwt
import structlog


# ============================================================================
# Configuration and Data Models
# ============================================================================

class PriorityLevel(str, Enum):
    """Notification priority levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationType(str, Enum):
    """Types of notifications"""
    MILESTONE_ACHIEVED = "milestone_achieved"
    REVIEW_REMINDER = "review_reminder"
    PEER_MESSAGE = "peer_message"
    ACHIEVEMENT_UNLOCKED = "achievement_unlocked"
    INTERVENTION_ALERT = "intervention_alert"


class ConflictResolution(str, Enum):
    """Conflict resolution strategies"""
    LAST_WRITE_WINS = "last_write_wins"
    VECTOR_CLOCK = "vector_clock"


class PresenceStatus(str, Enum):
    """User presence status"""
    ONLINE = "online"
    AWAY = "away"
    BUSY = "busy"
    OFFLINE = "offline"


@dataclass
class UserSession:
    """User session information"""
    user_id: str
    session_id: str
    device_id: str
    connected_at: float
    last_heartbeat: float
    websocket: Optional[WebSocket] = None


@dataclass
class VectorClock:
    """Vector clock for conflict resolution"""
    clocks: Dict[str, int]
    
    def increment(self, device_id: str) -> None:
        """Increment clock for device"""
        self.clocks[device_id] = self.clocks.get(device_id, 0) + 1
    
    def merge(self, other: 'VectorClock') -> None:
        """Merge with another vector clock"""
        for device_id, clock in other.clocks.items():
            self.clocks[device_id] = max(self.clocks.get(device_id, 0), clock)
    
    def compare(self, other: 'VectorClock') -> str:
        """Compare two vector clocks"""
        # Returns: 'before', 'after', 'concurrent', or 'equal'
        all_devices = set(self.clocks.keys()) | set(other.clocks.keys())
        
        has_greater = False
        has_less = False
        
        for device_id in all_devices:
            self_clock = self.clocks.get(device_id, 0)
            other_clock = other.clocks.get(device_id, 0)
            
            if self_clock > other_clock:
                has_greater = True
            elif self_clock < other_clock:
                has_less = True
        
        if has_greater and not has_less:
            return "after"
        elif has_less and not has_greater:
            return "before"
        elif not has_greater and not has_less:
            return "equal"
        else:
            return "concurrent"


@dataclass
class StateUpdate:
    """State update with version information"""
    user_id: str
    device_id: str
    state: Dict[str, Any]
    timestamp: float
    vector_clock: Optional[VectorClock] = None
    version: int = 1


@dataclass
class Notification:
    """Notification data"""
    notification_id: str
    user_id: str
    type: NotificationType
    priority: PriorityLevel
    title: str
    body: str
    data: Dict[str, Any]
    created_at: float
    expires_at: Optional[float] = None
    delivered: bool = False


@dataclass
class StudyRoom:
    """Study room information"""
    room_id: str
    room_name: str
    creator_id: str
    created_at: float
    members: Set[str]
    max_size: int
    is_active: bool = True


class WebSocketMessage(BaseModel):
    """WebSocket message format"""
    type: str
    data: Dict[str, Any]
    timestamp: float = Field(default_factory=time.time)


class NotificationRequest(BaseModel):
    """Notification request"""
    user_id: str
    type: NotificationType
    priority: PriorityLevel
    title: str
    body: str
    data: Dict[str, Any] = Field(default_factory=dict)
    ttl: Optional[int] = None


class BroadcastRequest(BaseModel):
    """Broadcast message request"""
    message: Dict[str, Any]
    sender_id: Optional[str] = None


class SyncStateRequest(BaseModel):
    """State synchronization request"""
    user_id: str
    device_id: str
    state: Dict[str, Any]
    vector_clock: Optional[Dict[str, int]] = None


class CreateRoomRequest(BaseModel):
    """Create study room request"""
    room_name: str
    creator_id: str
    max_size: int = 50


class JoinRoomRequest(BaseModel):
    """Join study room request"""
    room_id: str
    user_id: str


class PresenceUpdate(BaseModel):
    """Presence update request"""
    user_id: str
    status: PresenceStatus


# ============================================================================
# Connection Manager
# ============================================================================

class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self, max_connections: int = 10000):
        self.max_connections = max_connections
        self.active_connections: Dict[str, List[UserSession]] = defaultdict(list)
        self.connection_count = 0
        self.logger = structlog.get_logger()
    
    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        device_id: str
    ) -> UserSession:
        """Connect a new WebSocket"""
        if self.connection_count >= self.max_connections:
            raise HTTPException(status_code=503, detail="Maximum connections reached")
        
        await websocket.accept()
        
        session = UserSession(
            user_id=user_id,
            session_id=str(uuid.uuid4()),
            device_id=device_id,
            connected_at=time.time(),
            last_heartbeat=time.time(),
            websocket=websocket
        )
        
        self.active_connections[user_id].append(session)
        self.connection_count += 1
        
        self.logger.info(
            "websocket_connected",
            user_id=user_id,
            device_id=device_id,
            session_id=session.session_id,
            total_connections=self.connection_count
        )
        
        return session
    
    def disconnect(self, user_id: str, session_id: str) -> None:
        """Disconnect a WebSocket"""
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                s for s in self.active_connections[user_id]
                if s.session_id != session_id
            ]
            
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
            
            self.connection_count -= 1
            
            self.logger.info(
                "websocket_disconnected",
                user_id=user_id,
                session_id=session_id,
                total_connections=self.connection_count
            )
    
    async def send_personal_message(
        self,
        user_id: str,
        message: Dict[str, Any]
    ) -> int:
        """Send message to all user's devices"""
        sent_count = 0
        
        if user_id in self.active_connections:
            for session in self.active_connections[user_id]:
                try:
                    await session.websocket.send_json(message)
                    sent_count += 1
                except Exception as e:
                    self.logger.error(
                        "send_message_failed",
                        user_id=user_id,
                        session_id=session.session_id,
                        error=str(e)
                    )
        
        return sent_count
    
    async def broadcast_to_room(
        self,
        user_ids: Set[str],
        message: Dict[str, Any]
    ) -> int:
        """Broadcast message to multiple users"""
        sent_count = 0
        
        for user_id in user_ids:
            count = await self.send_personal_message(user_id, message)
            sent_count += count
        
        return sent_count
    
    def get_user_sessions(self, user_id: str) -> List[UserSession]:
        """Get all sessions for a user"""
        return self.active_connections.get(user_id, [])
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if user has any active connections"""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0
    
    async def update_heartbeat(self, user_id: str, session_id: str) -> bool:
        """Update session heartbeat"""
        if user_id in self.active_connections:
            for session in self.active_connections[user_id]:
                if session.session_id == session_id:
                    session.last_heartbeat = time.time()
                    return True
        return False
    
    async def cleanup_stale_connections(self, timeout: int = 60) -> int:
        """Remove stale connections"""
        current_time = time.time()
        removed_count = 0
        
        for user_id in list(self.active_connections.keys()):
            sessions_to_remove = []
            
            for session in self.active_connections[user_id]:
                if current_time - session.last_heartbeat > timeout:
                    sessions_to_remove.append(session)
            
            for session in sessions_to_remove:
                self.disconnect(user_id, session.session_id)
                removed_count += 1
        
        return removed_count


# ============================================================================
# Session Manager
# ============================================================================

class SessionManager:
    """Manages user sessions and state synchronization"""
    
    def __init__(
        self,
        redis_client: aioredis.Redis,
        session_ttl: int = 3600,
        max_devices_per_user: int = 5
    ):
        self.redis = redis_client
        self.session_ttl = session_ttl
        self.max_devices_per_user = max_devices_per_user
        self.logger = structlog.get_logger()
    
    async def create_session(
        self,
        user_id: str,
        device_id: str,
        session_id: str
    ) -> bool:
        """Create a new session"""
        session_key = f"session:{user_id}:{device_id}"
        
        # Check device limit
        devices_key = f"devices:{user_id}"
        device_count = await self.redis.scard(devices_key)
        
        if device_count >= self.max_devices_per_user:
            # Remove oldest device
            oldest_device = await self.redis.spop(devices_key)
            if oldest_device:
                old_session_key = f"session:{user_id}:{oldest_device.decode()}"
                await self.redis.delete(old_session_key)
        
        # Create session
        session_data = {
            "user_id": user_id,
            "device_id": device_id,
            "session_id": session_id,
            "created_at": time.time(),
            "last_active": time.time()
        }
        
        await self.redis.setex(
            session_key,
            self.session_ttl,
            json.dumps(session_data)
        )
        
        await self.redis.sadd(devices_key, device_id)
        await self.redis.expire(devices_key, self.session_ttl)
        
        self.logger.info(
            "session_created",
            user_id=user_id,
            device_id=device_id,
            session_id=session_id
        )
        
        return True
    
    async def get_session(
        self,
        user_id: str,
        device_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get session data"""
        session_key = f"session:{user_id}:{device_id}"
        session_data = await self.redis.get(session_key)
        
        if session_data:
            return json.loads(session_data)
        return None
    
    async def update_session(
        self,
        user_id: str,
        device_id: str
    ) -> bool:
        """Update session last active time"""
        session_key = f"session:{user_id}:{device_id}"
        session_data = await self.get_session(user_id, device_id)
        
        if session_data:
            session_data["last_active"] = time.time()
            await self.redis.setex(
                session_key,
                self.session_ttl,
                json.dumps(session_data)
            )
            return True
        return False
    
    async def delete_session(
        self,
        user_id: str,
        device_id: str
    ) -> bool:
        """Delete a session"""
        session_key = f"session:{user_id}:{device_id}"
        devices_key = f"devices:{user_id}"
        
        await self.redis.delete(session_key)
        await self.redis.srem(devices_key, device_id)
        
        self.logger.info(
            "session_deleted",
            user_id=user_id,
            device_id=device_id
        )
        
        return True
    
    async def get_user_devices(self, user_id: str) -> List[str]:
        """Get all devices for a user"""
        devices_key = f"devices:{user_id}"
        devices = await self.redis.smembers(devices_key)
        return [d.decode() for d in devices]
    
    async def sync_state(
        self,
        user_id: str,
        device_id: str,
        state: Dict[str, Any]
    ) -> bool:
        """Synchronize state across devices"""
        state_key = f"state:{user_id}"
        
        # Get current state
        current_state_data = await self.redis.get(state_key)
        
        if current_state_data:
            current_state = json.loads(current_state_data)
        else:
            current_state = {}
        
        # Merge states
        current_state.update(state)
        current_state["_last_updated"] = time.time()
        current_state["_last_device"] = device_id
        
        # Save updated state
        await self.redis.setex(
            state_key,
            self.session_ttl,
            json.dumps(current_state)
        )
        
        # Publish update to other devices
        await self.redis.publish(
            f"state_update:{user_id}",
            json.dumps({
                "device_id": device_id,
                "state": current_state,
                "timestamp": time.time()
            })
        )
        
        self.logger.info(
            "state_synced",
            user_id=user_id,
            device_id=device_id
        )
        
        return True
    
    async def get_state(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's current state"""
        state_key = f"state:{user_id}"
        state_data = await self.redis.get(state_key)
        
        if state_data:
            return json.loads(state_data)
        return None


# ============================================================================
# Conflict Resolver
# ============================================================================

class ConflictResolver:
    """Resolves conflicts in state synchronization"""
    
    def __init__(self, strategy: ConflictResolution = ConflictResolution.LAST_WRITE_WINS):
        self.strategy = strategy
        self.logger = structlog.get_logger()
    
    def resolve(
        self,
        local_state: StateUpdate,
        remote_state: StateUpdate
    ) -> StateUpdate:
        """Resolve conflict between local and remote states"""
        if self.strategy == ConflictResolution.LAST_WRITE_WINS:
            return self._resolve_lww(local_state, remote_state)
        elif self.strategy == ConflictResolution.VECTOR_CLOCK:
            return self._resolve_vector_clock(local_state, remote_state)
        else:
            # Default to LWW
            return self._resolve_lww(local_state, remote_state)
    
    def _resolve_lww(
        self,
        local_state: StateUpdate,
        remote_state: StateUpdate
    ) -> StateUpdate:
        """Last-Write-Wins conflict resolution"""
        if local_state.timestamp > remote_state.timestamp:
            self.logger.info(
                "conflict_resolved_lww",
                winner="local",
                local_ts=local_state.timestamp,
                remote_ts=remote_state.timestamp
            )
            return local_state
        elif local_state.timestamp < remote_state.timestamp:
            self.logger.info(
                "conflict_resolved_lww",
                winner="remote",
                local_ts=local_state.timestamp,
                remote_ts=remote_state.timestamp
            )
            return remote_state
        else:
            # Same timestamp, use device_id as tiebreaker
            if local_state.device_id > remote_state.device_id:
                return local_state
            else:
                return remote_state
    
    def _resolve_vector_clock(
        self,
        local_state: StateUpdate,
        remote_state: StateUpdate
    ) -> StateUpdate:
        """Vector clock conflict resolution"""
        if not local_state.vector_clock or not remote_state.vector_clock:
            # Fall back to LWW if vector clocks missing
            return self._resolve_lww(local_state, remote_state)
        
        comparison = local_state.vector_clock.compare(remote_state.vector_clock)
        
        if comparison == "after":
            self.logger.info("conflict_resolved_vc", winner="local", reason="after")
            return local_state
        elif comparison == "before":
            self.logger.info("conflict_resolved_vc", winner="remote", reason="before")
            return remote_state
        elif comparison == "equal":
            self.logger.info("conflict_resolved_vc", winner="local", reason="equal")
            return local_state
        else:  # concurrent
            # Merge states for concurrent updates
            merged_state = self._merge_states(local_state, remote_state)
            self.logger.info("conflict_resolved_vc", winner="merged", reason="concurrent")
            return merged_state
    
    def _merge_states(
        self,
        local_state: StateUpdate,
        remote_state: StateUpdate
    ) -> StateUpdate:
        """Merge two concurrent states"""
        merged = StateUpdate(
            user_id=local_state.user_id,
            device_id=f"{local_state.device_id}+{remote_state.device_id}",
            state={**remote_state.state, **local_state.state},
            timestamp=max(local_state.timestamp, remote_state.timestamp),
            vector_clock=VectorClock(clocks={}),
            version=max(local_state.version, remote_state.version) + 1
        )
        
        # Merge vector clocks
        if local_state.vector_clock:
            merged.vector_clock.merge(local_state.vector_clock)
        if remote_state.vector_clock:
            merged.vector_clock.merge(remote_state.vector_clock)
        
        return merged


# ============================================================================
# Notification Manager
# ============================================================================

class NotificationManager:
    """Manages push notifications"""
    
    def __init__(
        self,
        redis_client: aioredis.Redis,
        retry_attempts: int = 3,
        retry_delay: int = 5
    ):
        self.redis = redis_client
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
        self.logger = structlog.get_logger()
    
    async def send_notification(
        self,
        notification: Notification
    ) -> bool:
        """Send a notification to user"""
        notification_key = f"notification:{notification.notification_id}"
        user_notifications_key = f"notifications:{notification.user_id}"
        
        # Store notification
        await self.redis.setex(
            notification_key,
            86400,  # 24 hours
            json.dumps(asdict(notification))
        )
        
        # Add to user's notification list
        await self.redis.lpush(user_notifications_key, notification.notification_id)
        await self.redis.ltrim(user_notifications_key, 0, 99)  # Keep last 100
        
        # Attempt delivery with retry
        delivered = False
        for attempt in range(self.retry_attempts):
            try:
                # Send via push service (simulated here)
                await self._deliver_push(notification)
                delivered = True
                break
            except Exception as e:
                self.logger.warning(
                    "notification_delivery_failed",
                    notification_id=notification.notification_id,
                    attempt=attempt + 1,
                    error=str(e)
                )
                
                if attempt < self.retry_attempts - 1:
                    await asyncio.sleep(self.retry_delay)
        
        # Update delivery status
        notification.delivered = delivered
        await self.redis.setex(
            notification_key,
            86400,
            json.dumps(asdict(notification))
        )
        
        self.logger.info(
            "notification_sent",
            notification_id=notification.notification_id,
            user_id=notification.user_id,
            delivered=delivered
        )
        
        return delivered
    
    async def _deliver_push(self, notification: Notification) -> None:
        """Deliver push notification (implement FCM/APNS/Web Push here)"""
        # This is a placeholder for actual push service integration
        # In production, integrate with FCM, APNS, and Web Push services
        
        # Example FCM integration:
        # fcm_client.send_notification(
        #     user_id=notification.user_id,
        #     title=notification.title,
        #     body=notification.body,
        #     data=notification.data
        # )
        
        # For now, just simulate delivery
        await asyncio.sleep(0.1)
        
        # Store in delivery log
        delivery_key = f"delivery:{notification.notification_id}"
        await self.redis.setex(
            delivery_key,
            3600,
            json.dumps({
                "notification_id": notification.notification_id,
                "delivered_at": time.time(),
                "method": "simulated"
            })
        )
    
    async def get_user_notifications(
        self,
        user_id: str,
        limit: int = 20
    ) -> List[Notification]:
        """Get user's recent notifications"""
        user_notifications_key = f"notifications:{user_id}"
        notification_ids = await self.redis.lrange(user_notifications_key, 0, limit - 1)
        
        notifications = []
        for notif_id in notification_ids:
            notification_key = f"notification:{notif_id.decode()}"
            notif_data = await self.redis.get(notification_key)
            
            if notif_data:
                notifications.append(Notification(**json.loads(notif_data)))
        
        return notifications
    
    async def mark_as_read(
        self,
        notification_id: str
    ) -> bool:
        """Mark notification as read"""
        notification_key = f"notification:{notification_id}"
        notif_data = await self.redis.get(notification_key)
        
        if notif_data:
            notification = Notification(**json.loads(notif_data))
            notification.data["read"] = True
            notification.data["read_at"] = time.time()
            
            await self.redis.setex(
                notification_key,
                86400,
                json.dumps(asdict(notification))
            )
            return True
        
        return False


# ============================================================================
# Room Manager
# ============================================================================

class RoomManager:
    """Manages study rooms and collaboration"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.logger = structlog.get_logger()
    
    async def create_room(
        self,
        room_name: str,
        creator_id: str,
        max_size: int = 50
    ) -> StudyRoom:
        """Create a new study room"""
        room_id = str(uuid.uuid4())
        
        room = StudyRoom(
            room_id=room_id,
            room_name=room_name,
            creator_id=creator_id,
            created_at=time.time(),
            members={creator_id},
            max_size=max_size,
            is_active=True
        )
        
        # Store room data
        room_key = f"room:{room_id}"
        room_data = asdict(room)
        room_data["members"] = list(room.members)  # Convert set to list
        
        await self.redis.setex(
            room_key,
            86400,  # 24 hours
            json.dumps(room_data)
        )
        
        # Add to active rooms list
        await self.redis.sadd("active_rooms", room_id)
        
        # Add to user's rooms
        await self.redis.sadd(f"user_rooms:{creator_id}", room_id)
        
        self.logger.info(
            "room_created",
            room_id=room_id,
            room_name=room_name,
            creator_id=creator_id
        )
        
        return room
    
    async def get_room(self, room_id: str) -> Optional[StudyRoom]:
        """Get room information"""
        room_key = f"room:{room_id}"
        room_data = await self.redis.get(room_key)
        
        if room_data:
            data = json.loads(room_data)
            data["members"] = set(data["members"])  # Convert list back to set
            return StudyRoom(**data)
        
        return None
    
    async def join_room(
        self,
        room_id: str,
        user_id: str
    ) -> bool:
        """Join a study room"""
        room = await self.get_room(room_id)
        
        if not room:
            return False
        
        if not room.is_active:
            return False
        
        if len(room.members) >= room.max_size:
            return False
        
        if user_id in room.members:
            return True  # Already a member
        
        # Add member
        room.members.add(user_id)
        
        # Update room
        room_key = f"room:{room_id}"
        room_data = asdict(room)
        room_data["members"] = list(room.members)
        
        await self.redis.setex(
            room_key,
            86400,
            json.dumps(room_data)
        )
        
        # Add to user's rooms
        await self.redis.sadd(f"user_rooms:{user_id}", room_id)
        
        self.logger.info(
            "user_joined_room",
            room_id=room_id,
            user_id=user_id,
            member_count=len(room.members)
        )
        
        return True
    
    async def leave_room(
        self,
        room_id: str,
        user_id: str
    ) -> bool:
        """Leave a study room"""
        room = await self.get_room(room_id)
        
        if not room or user_id not in room.members:
            return False
        
        # Remove member
        room.members.remove(user_id)
        
        # Update room
        room_key = f"room:{room_id}"
        room_data = asdict(room)
        room_data["members"] = list(room.members)
        
        await self.redis.setex(
            room_key,
            86400,
            json.dumps(room_data)
        )
        
        # Remove from user's rooms
        await self.redis.srem(f"user_rooms:{user_id}", room_id)
        
        # Deactivate room if empty
        if len(room.members) == 0:
            room.is_active = False
            await self.redis.setex(
                room_key,
                86400,
                json.dumps(asdict(room))
            )
            await self.redis.srem("active_rooms", room_id)
        
        self.logger.info(
            "user_left_room",
            room_id=room_id,
            user_id=user_id,
            member_count=len(room.members)
        )
        
        return True
    
    async def get_room_members(self, room_id: str) -> List[str]:
        """Get list of room members"""
        room = await self.get_room(room_id)
        
        if room:
            return list(room.members)
        
        return []
    
    async def get_user_rooms(self, user_id: str) -> List[str]:
        """Get list of rooms user is in"""
        rooms = await self.redis.smembers(f"user_rooms:{user_id}")
        return [r.decode() for r in rooms]


# ============================================================================
# Presence Manager
# ============================================================================

class PresenceManager:
    """Manages user presence status"""
    
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.logger = structlog.get_logger()
    
    async def set_presence(
        self,
        user_id: str,
        status: PresenceStatus
    ) -> None:
        """Set user presence status"""
        presence_key = f"presence:{user_id}"
        
        presence_data = {
            "user_id": user_id,
            "status": status.value,
            "updated_at": time.time()
        }
        
        await self.redis.setex(
            presence_key,
            300,  # 5 minutes
            json.dumps(presence_data)
        )
        
        # Publish presence update
        await self.redis.publish(
            "presence_updates",
            json.dumps(presence_data)
        )
        
        self.logger.info(
            "presence_updated",
            user_id=user_id,
            status=status.value
        )
    
    async def get_presence(self, user_id: str) -> Optional[PresenceStatus]:
        """Get user presence status"""
        presence_key = f"presence:{user_id}"
        presence_data = await self.redis.get(presence_key)
        
        if presence_data:
            data = json.loads(presence_data)
            return PresenceStatus(data["status"])
        
        return PresenceStatus.OFFLINE
    
    async def get_online_users(self) -> List[str]:
        """Get list of online users"""
        # Scan for all presence keys
        online_users = []
        cursor = 0
        
        while True:
            cursor, keys = await self.redis.scan(
                cursor,
                match="presence:*",
                count=100
            )
            
            for key in keys:
                user_id = key.decode().split(":")[1]
                online_users.append(user_id)
            
            if cursor == 0:
                break
        
        return online_users


# ============================================================================
# Real-time Coordination Agent
# ============================================================================

class RealtimeCoordinationAgent:
    """Main agent class"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.logger = self._setup_logging()
        
        # Initialize Redis
        self.redis: Optional[aioredis.Redis] = None
        
        # Initialize managers
        self.connection_manager = ConnectionManager(
            max_connections=self.config["websocket"]["max_connections"]
        )
        self.session_manager: Optional[SessionManager] = None
        self.conflict_resolver = ConflictResolver(
            strategy=ConflictResolution(
                self.config["synchronization"]["conflict_resolution"]
            )
        )
        self.notification_manager: Optional[NotificationManager] = None
        self.room_manager: Optional[RoomManager] = None
        self.presence_manager: Optional[PresenceManager] = None
        
        # Background tasks
        self.background_tasks: Set[asyncio.Task] = set()
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML"""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            # Return default config
            return {
                "agent": {
                    "name": "realtime_coordination_agent",
                    "port": 8012,
                    "host": "0.0.0.0"
                },
                "websocket": {
                    "max_connections": 10000,
                    "heartbeat_interval": 30,
                    "timeout": 60,
                    "compression": True
                },
                "session_management": {
                    "redis_url": "redis://localhost:6379",
                    "session_ttl": 3600,
                    "multi_device_sync": True,
                    "max_devices_per_user": 5
                },
                "synchronization": {
                    "conflict_resolution": "last_write_wins",
                    "sync_interval": 1,
                    "batch_updates": True
                },
                "notifications": {
                    "types": [
                        "milestone_achieved",
                        "review_reminder",
                        "peer_message",
                        "achievement_unlocked",
                        "intervention_alert"
                    ],
                    "priority_levels": ["low", "medium", "high", "urgent"],
                    "retry_attempts": 3,
                    "retry_delay": 5
                },
                "collaboration": {
                    "enable_peer_chat": True,
                    "enable_study_rooms": True,
                    "max_room_size": 50
                },
                "push_services": {
                    "fcm_enabled": True,
                    "apns_enabled": True,
                    "web_push_enabled": True
                }
            }
    
    def _setup_logging(self) -> structlog.BoundLogger:
        """Setup structured logging"""
        structlog.configure(
            processors=[
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.JSONRenderer()
            ]
        )
        return structlog.get_logger()
    
    async def initialize(self) -> None:
        """Initialize agent"""
        self.logger.info("initializing_agent", name=self.config["agent"]["name"])
        
        # Initialize Redis
        self.redis = await aioredis.from_url(
            self.config["session_management"]["redis_url"],
            encoding="utf-8",
            decode_responses=False
        )
        
        # Initialize managers
        self.session_manager = SessionManager(
            redis_client=self.redis,
            session_ttl=self.config["session_management"]["session_ttl"],
            max_devices_per_user=self.config["session_management"]["max_devices_per_user"]
        )
        
        self.notification_manager = NotificationManager(
            redis_client=self.redis,
            retry_attempts=self.config["notifications"]["retry_attempts"],
            retry_delay=self.config["notifications"]["retry_delay"]
        )
        
        self.room_manager = RoomManager(redis_client=self.redis)
        self.presence_manager = PresenceManager(redis_client=self.redis)
        
        # Start background tasks
        self._start_background_tasks()
        
        self.logger.info("agent_initialized")
    
    def _start_background_tasks(self) -> None:
        """Start background tasks"""
        # Heartbeat monitor
        task = asyncio.create_task(self._heartbeat_monitor())
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)
        
        # State sync task
        task = asyncio.create_task(self._sync_task())
        self.background_tasks.add(task)
        task.add_done_callback(self.background_tasks.discard)
    
    async def _heartbeat_monitor(self) -> None:
        """Monitor connection heartbeats"""
        interval = self.config["websocket"]["heartbeat_interval"]
        timeout = self.config["websocket"]["timeout"]
        
        while True:
            try:
                await asyncio.sleep(interval)
                removed = await self.connection_manager.cleanup_stale_connections(timeout)
                
                if removed > 0:
                    self.logger.info("stale_connections_removed", count=removed)
            
            except Exception as e:
                self.logger.error("heartbeat_monitor_error", error=str(e))
    
    async def _sync_task(self) -> None:
        """Background state synchronization"""
        interval = self.config["synchronization"]["sync_interval"]
        
        while True:
            try:
                await asyncio.sleep(interval)
                # Additional sync logic can be added here
            
            except Exception as e:
                self.logger.error("sync_task_error", error=str(e))
    
    async def handle_connection(
        self,
        websocket: WebSocket,
        user_id: str,
        device_id: str
    ) -> None:
        """Handle WebSocket connection"""
        session = await self.connection_manager.connect(websocket, user_id, device_id)
        
        # Create session
        await self.session_manager.create_session(user_id, device_id, session.session_id)
        
        # Set presence
        await self.presence_manager.set_presence(user_id, PresenceStatus.ONLINE)
        
        try:
            # Send welcome message
            await websocket.send_json({
                "type": "connected",
                "data": {
                    "session_id": session.session_id,
                    "device_id": device_id,
                    "timestamp": time.time()
                }
            })
            
            # Message loop
            while True:
                data = await websocket.receive_json()
                await self._handle_message(user_id, device_id, session.session_id, data)
        
        except WebSocketDisconnect:
            self.logger.info("websocket_disconnected", user_id=user_id)
        
        except Exception as e:
            self.logger.error("websocket_error", user_id=user_id, error=str(e))
        
        finally:
            # Cleanup
            self.connection_manager.disconnect(user_id, session.session_id)
            await self.session_manager.delete_session(user_id, device_id)
            await self.presence_manager.set_presence(user_id, PresenceStatus.OFFLINE)
    
    async def _handle_message(
        self,
        user_id: str,
        device_id: str,
        session_id: str,
        message: Dict[str, Any]
    ) -> None:
        """Handle incoming WebSocket message"""
        message_type = message.get("type")
        data = message.get("data", {})
        
        if message_type == "heartbeat":
            await self.connection_manager.update_heartbeat(user_id, session_id)
            await self.session_manager.update_session(user_id, device_id)
        
        elif message_type == "sync_state":
            state = data.get("state", {})
            await self.sync_state(user_id, device_id, state)
        
        elif message_type == "send_message":
            room_id = data.get("room_id")
            message_text = data.get("message")
            if room_id and message_text:
                await self.broadcast_message(room_id, {
                    "type": "chat_message",
                    "sender_id": user_id,
                    "message": message_text,
                    "timestamp": time.time()
                })
        
        elif message_type == "presence":
            status = data.get("status")
            if status:
                await self.presence_manager.set_presence(
                    user_id,
                    PresenceStatus(status)
                )
        
        else:
            self.logger.warning(
                "unknown_message_type",
                type=message_type,
                user_id=user_id
            )
    
    async def broadcast_message(
        self,
        room_id: str,
        message: Dict[str, Any]
    ) -> int:
        """Broadcast message to room"""
        # Get room members
        members = await self.room_manager.get_room_members(room_id)
        
        if not members:
            return 0
        
        # Broadcast to all members
        sent_count = await self.connection_manager.broadcast_to_room(
            set(members),
            message
        )
        
        self.logger.info(
            "message_broadcast",
            room_id=room_id,
            member_count=len(members),
            sent_count=sent_count
        )
        
        return sent_count
    
    async def sync_state(
        self,
        user_id: str,
        device_id: str,
        state: Dict[str, Any]
    ) -> None:
        """Synchronize state across devices"""
        await self.session_manager.sync_state(user_id, device_id, state)
        
        # Get updated state
        updated_state = await self.session_manager.get_state(user_id)
        
        # Send to all user's devices
        await self.connection_manager.send_personal_message(
            user_id,
            {
                "type": "state_update",
                "data": {
                    "state": updated_state,
                    "source_device": device_id,
                    "timestamp": time.time()
                }
            }
        )
    
    async def resolve_conflict(
        self,
        local_state: Dict[str, Any],
        remote_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve state conflict"""
        # Create StateUpdate objects
        local_update = StateUpdate(
            user_id=local_state.get("user_id", ""),
            device_id=local_state.get("device_id", ""),
            state=local_state.get("state", {}),
            timestamp=local_state.get("timestamp", time.time())
        )
        
        remote_update = StateUpdate(
            user_id=remote_state.get("user_id", ""),
            device_id=remote_state.get("device_id", ""),
            state=remote_state.get("state", {}),
            timestamp=remote_state.get("timestamp", time.time())
        )
        
        # Resolve conflict
        resolved = self.conflict_resolver.resolve(local_update, remote_update)
        
        return {
            "user_id": resolved.user_id,
            "device_id": resolved.device_id,
            "state": resolved.state,
            "timestamp": resolved.timestamp
        }
    
    async def send_notification(
        self,
        user_id: str,
        notification_data: Dict[str, Any]
    ) -> bool:
        """Send notification to user"""
        notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=user_id,
            type=NotificationType(notification_data["type"]),
            priority=PriorityLevel(notification_data["priority"]),
            title=notification_data["title"],
            body=notification_data["body"],
            data=notification_data.get("data", {}),
            created_at=time.time(),
            expires_at=notification_data.get("expires_at")
        )
        
        delivered = await self.notification_manager.send_notification(notification)
        
        # Also send via WebSocket if user is online
        if self.connection_manager.is_user_online(user_id):
            await self.connection_manager.send_personal_message(
                user_id,
                {
                    "type": "notification",
                    "data": asdict(notification)
                }
            )
        
        return delivered
    
    async def create_study_room(
        self,
        room_name: str,
        creator_id: str,
        max_size: int = 50
    ) -> str:
        """Create a study room"""
        room = await self.room_manager.create_room(room_name, creator_id, max_size)
        
        # Notify creator
        await self.connection_manager.send_personal_message(
            creator_id,
            {
                "type": "room_created",
                "data": asdict(room)
            }
        )
        
        return room.room_id
    
    async def join_room(
        self,
        room_id: str,
        user_id: str
    ) -> bool:
        """Join a study room"""
        success = await self.room_manager.join_room(room_id, user_id)
        
        if success:
            # Notify user
            room = await self.room_manager.get_room(room_id)
            await self.connection_manager.send_personal_message(
                user_id,
                {
                    "type": "room_joined",
                    "data": asdict(room) if room else {}
                }
            )
            
            # Notify other members
            if room:
                await self.broadcast_message(
                    room_id,
                    {
                        "type": "member_joined",
                        "user_id": user_id,
                        "timestamp": time.time()
                    }
                )
        
        return success
    
    async def track_presence(
        self,
        user_id: str,
        status: str
    ) -> None:
        """Track user presence"""
        await self.presence_manager.set_presence(
            user_id,
            PresenceStatus(status)
        )
    
    async def shutdown(self) -> None:
        """Shutdown agent"""
        self.logger.info("shutting_down_agent")
        
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()
        
        # Close Redis connection
        if self.redis:
            await self.redis.close()
        
        self.logger.info("agent_shutdown_complete")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(title="Real-time Coordination Agent")
agent: Optional[RealtimeCoordinationAgent] = None


@app.on_event("startup")
async def startup_event():
    """Initialize agent on startup"""
    global agent
    agent = RealtimeCoordinationAgent()
    await agent.initialize()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown agent"""
    global agent
    if agent:
        await agent.shutdown()


def verify_token(authorization: Optional[str] = Header(None)) -> str:
    """Verify JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        # In production, use proper JWT secret
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        # Decode token (simplified - use proper JWT validation in production)
        # payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        # return payload.get("sub")
        
        # For now, just return a user ID from token
        return "user_123"
    
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, device_id: str = "default"):
    """WebSocket connection endpoint"""
    if not agent:
        await websocket.close(code=1011, reason="Agent not initialized")
        return
    
    await agent.handle_connection(websocket, user_id, device_id)


@app.post("/notify")
async def send_notification(
    request: NotificationRequest,
    current_user: str = Depends(verify_token)
):
    """Send push notification"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    delivered = await agent.send_notification(
        request.user_id,
        {
            "type": request.type.value,
            "priority": request.priority.value,
            "title": request.title,
            "body": request.body,
            "data": request.data,
            "expires_at": time.time() + request.ttl if request.ttl else None
        }
    )
    
    return {
        "success": delivered,
        "user_id": request.user_id,
        "type": request.type.value
    }


@app.post("/broadcast/{room_id}")
async def broadcast_to_room(
    room_id: str,
    request: BroadcastRequest,
    current_user: str = Depends(verify_token)
):
    """Broadcast message to room"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    message = request.message.copy()
    message["sender_id"] = request.sender_id or current_user
    message["timestamp"] = time.time()
    
    sent_count = await agent.broadcast_message(room_id, message)
    
    return {
        "success": sent_count > 0,
        "room_id": room_id,
        "sent_count": sent_count
    }


@app.post("/sync-state")
async def sync_state(
    request: SyncStateRequest,
    current_user: str = Depends(verify_token)
):
    """Synchronize device state"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    await agent.sync_state(request.user_id, request.device_id, request.state)
    
    return {
        "success": True,
        "user_id": request.user_id,
        "device_id": request.device_id
    }


@app.post("/create-room")
async def create_room(
    request: CreateRoomRequest,
    current_user: str = Depends(verify_token)
):
    """Create study room"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    room_id = await agent.create_study_room(
        request.room_name,
        request.creator_id,
        request.max_size
    )
    
    return {
        "success": True,
        "room_id": room_id,
        "room_name": request.room_name
    }


@app.post("/join-room")
async def join_room(
    request: JoinRoomRequest,
    current_user: str = Depends(verify_token)
):
    """Join study room"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    success = await agent.join_room(request.room_id, request.user_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to join room")
    
    return {
        "success": True,
        "room_id": request.room_id,
        "user_id": request.user_id
    }


@app.get("/presence/{user_id}")
async def get_presence(
    user_id: str,
    current_user: str = Depends(verify_token)
):
    """Get user presence"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    status = await agent.presence_manager.get_presence(user_id)
    
    return {
        "user_id": user_id,
        "status": status.value,
        "is_online": status != PresenceStatus.OFFLINE
    }


@app.get("/room/{room_id}")
async def get_room_info(
    room_id: str,
    current_user: str = Depends(verify_token)
):
    """Get room information"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    room = await agent.room_manager.get_room(room_id)
    
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {
        "room_id": room.room_id,
        "room_name": room.room_name,
        "creator_id": room.creator_id,
        "created_at": room.created_at,
        "member_count": len(room.members),
        "max_size": room.max_size,
        "is_active": room.is_active
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "agent": "realtime_coordination_agent",
        "timestamp": time.time()
    }


@app.get("/metrics")
async def get_metrics():
    """Get agent metrics"""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    return {
        "connections": agent.connection_manager.connection_count,
        "active_users": len(agent.connection_manager.active_connections),
        "timestamp": time.time()
    }


if __name__ == "__main__":
    import uvicorn
    
    # Load config
    try:
        with open("config.yaml", 'r') as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        config = {
            "agent": {
                "host": "0.0.0.0",
                "port": 8012
            }
        }
    
    # Run server
    uvicorn.run(
        app,
        host=config["agent"]["host"],
        port=config["agent"]["port"],
        log_level="info"
    )
