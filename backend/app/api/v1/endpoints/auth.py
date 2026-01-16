from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.core.database import get_session
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from pydantic import BaseModel, EmailStr, Field

router = APIRouter()

# Schéma Pydantic pour l'inscription
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)  # bcrypt limit
    full_name: str
    role: str = "student" # Par defaut

@router.post("/signup")
async def signup(user_in: UserCreate, session: AsyncSession = Depends(get_session)):
    # Vérifier si email existe déjà
    statement = select(User).where(User.email == user_in.email)
    result = await session.execute(statement)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    # Créer l'user
    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role
    )
    session.add(new_user)
    await session.commit()
    return {"message": "Utilisateur créé avec succès"}

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    # Authentification
    statement = select(User).where(User.email == form_data.username)
    result = await session.execute(statement)
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Email ou mot de passe incorrect")

    # Création du token
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}