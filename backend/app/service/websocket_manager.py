from typing import List
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Liste des connexions actives
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("Nouvelle connexion WebSocket établie.")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info("Connexion WebSocket fermée.")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Envoie un message à un utilisateur spécifique"""
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        """Envoie un message à tous les utilisateurs (utile pour des notifs globales)"""
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()