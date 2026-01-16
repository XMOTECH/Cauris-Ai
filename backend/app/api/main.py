import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.core.database import init_db
from app.models.base import HealthCheck
from app.api.v1.api import api_router
from fastapi.middleware.cors import CORSMiddleware

# En production, cela permet de filtrer les logs et de les envoyer vers des fichiers ou des systemes externes
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gere le cycle de vie de l'application (demarrage et arret).
    """
    logger.info("Demarrage de l'application et initialisation de la DB...")
    try:
        await init_db()
        logger.info("Connexion a la base de donnees etablie avec succes.")
    except Exception as e:
        logger.error(f"Erreur critique lors de l'initialisation de la DB : {e}")
        raise e

    yield

    logger.info("Arret de l'application.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Configuration du logging standard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ En prod, on mettra l'URL spécifique. Pour le dev : "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    """
    Route racine pour verification rapide.
    """
    return {"message": "University Chatbot API is running"}

@app.get("/health")
async def health_check():
    """
    Route de sante utilisee par Docker ou Kubernetes pour verifier l'etat du service.
    """
    return {
        "status": "active",
        "database": "connected",
        "environment": "production" if not settings.DEBUG else "development"
    }