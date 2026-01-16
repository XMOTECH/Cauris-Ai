from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from app.service.ingestion import ingestion_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

async def run_ingestion_task(file: UploadFile):
    """
    Tache d'arriere-plan pour traiter le fichier sans bloquer l'API.
    """
    try:
        await ingestion_service.process_pdf(file)
    except Exception as e:
        logger.error(f"Echec de la tache de fond pour {file.filename}: {e}")

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Endpoint pour uploader un document PDF (RAG).
    Le traitement est asynchrone.
    """
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptes.")

    # On lance le traitement en arriere-plan
    background_tasks.add_task(run_ingestion_task, file)

    return {
        "message": "Fichier recu. Le traitement (indexation) a demarre en arriere-plan.",
        "filename": file.filename
    }