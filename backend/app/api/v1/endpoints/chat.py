import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select # <--- Il manquait cet import pour la DB
from pydantic import BaseModel
from jose import jwt, JWTError

from app.core.database import get_session
from app.core.config import settings
from app.core.security import ALGORITHM
from app.models.user import User
from app.models.chat import ChatHistory

# ATTENTION ICI : On harmonise tout vers "app.service" (singulier)
from app.service.rag_service import rag_service 
from app.service.websocket_manager import manager 
from app.api.deps import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__) # <--- Il manquait le logger

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str

# --- Route HTTP Classique ---
@router.post("/query", response_model=ChatResponse)
async def ask_question(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question vide")
    
    answer = await rag_service.get_answer(request.question)
    
    chat_entry = ChatHistory(
        user_id=current_user.id,
        question=request.question,
        answer=answer
    )
    session.add(chat_entry)
    await session.commit()

    return ChatResponse(answer=answer)

@router.get("/history")
async def get_history(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    statement = select(ChatHistory).where(ChatHistory.user_id == current_user.id)
    result = await session.execute(statement)
    chats = result.scalars().all()
    return chats

# --- Partie WebSocket ---

async def get_user_from_token(token: str, session: AsyncSession):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            logger.error("Token valide mais 'sub' (email) manquant")
            return None
    except JWTError as e:
        logger.error(f"Erreur de décodage du token : {str(e)}") # <--- Ceci vous dira s'il est expiré
        return None
    
    statement = select(User).where(User.email == email)
    result = await session.execute(statement)
    return result.scalars().first()

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    session: AsyncSession = Depends(get_session)
):
    user = await get_user_from_token(token, session)
    if not user:
        await websocket.close(code=4003)
        return

    await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # Feedback immédiat
            await manager.send_personal_message(" : Je réfléchis...", websocket)
            
            # Génération IA
            answer = await rag_service.get_answer(data)
            
            # Sauvegarde
            chat_entry = ChatHistory(user_id=user.id, question=data, answer=answer)
            session.add(chat_entry)
            await session.commit()

            # Réponse finale
            await manager.send_personal_message(f" : {answer}", websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"Utilisateur {user.email} déconnecté du chat.")