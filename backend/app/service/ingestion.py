from pypdf import PdfReader
from app.core.vector_db import vector_store
import logging

logger = logging.getLogger(__name__)

def split_text(text, chunk_size=1000, overlap=200):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start = end - overlap
        if start >= len(text):
            break
    return chunks

class IngestionService:
    def __init__(self):
        self.chunk_size = 1000
        self.overlap = 200

    async def process_pdf(self, file):
        try:
            # Read PDF
            reader = PdfReader(file.file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""

            if not text.strip():
                logger.warning(f"No text extracted from {file.filename}")
                return

            # Split text
            chunks = split_text(text, self.chunk_size, self.overlap)

            # Add to vector store with metadata
            metadatas = [{"source": file.filename} for _ in chunks]
            vector_store.add_texts(chunks, metadatas=metadatas)

            logger.info(f"Processed and indexed {len(chunks)} chunks from {file.filename}")
        except Exception as e:
            logger.error(f"Error processing PDF {file.filename}: {e}")
            raise

ingestion_service = IngestionService()