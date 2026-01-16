import logging
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_qdrant import QdrantVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from app.core.vector_db import vector_store
from app.core.config import settings

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        # Utiliser le vector_store global
        self.vector_store = vector_store
        self.retriever = self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 4} # On récupère les 4 meilleurs morceaux
        )

        # 3. Initialiser le LLM (Groq avec Gemma)
        self.llm = ChatGroq(
            temperature=0,
            model_name="llama-3.3-70b-versatile",
            groq_api_key=settings.GROQ_API_KEY
        )

        # 4. Le Prompt (Les instructions données au bot)
        self.prompt_template = ChatPromptTemplate.from_template("""
        Tu es un assistant universitaire utile et précis.
        Utilise impérativement les éléments de contexte suivants pour répondre à la question de l'étudiant.
        Si tu ne trouves pas la réponse dans le contexte, dis poliment que tu ne sais pas.
        
        Contexte (Extraits des documents officiels) :
        {context}
        
        Question de l'étudiant : {question}
        
        Réponse :
        """)

    def format_docs(self, docs):
        """Formate les documents récupérés pour les insérer dans le prompt."""
        return "\n\n".join(doc.page_content for doc in docs)

    async def get_answer(self, question: str):
        """
        Exécute la chaîne RAG complète.
        """
        logger.info(f"Traitement de la question : {question}")
        
        # Création de la chaîne LangChain (LCEL)
        rag_chain = (
            {"context": self.retriever | self.format_docs, "question": RunnablePassthrough()}
            | self.prompt_template
            | self.llm
            | StrOutputParser()
        )

        # Invocation
        try:
            response = await rag_chain.ainvoke(question)
            return response
        except Exception as e:
            logger.error(f"Erreur lors de la génération RAG : {e}")
            raise e

# Singleton
rag_service = RAGService()