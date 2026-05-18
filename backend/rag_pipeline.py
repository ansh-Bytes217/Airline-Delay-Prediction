import os
import logging
import numpy as np
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.llms import HuggingFacePipeline
from langchain_community.retrievers import BM25Retriever
from transformers import pipeline
from sentence_transformers import CrossEncoder

# Lightweight Hybrid Retriever using Reciprocal Rank Fusion (RRF)
# Combines sparse BM25 keyword search + dense FAISS semantic search
class HybridRetriever:
    def __init__(self, bm25, dense, weights=(0.3, 0.7), k=8):
        self.bm25 = bm25
        self.dense = dense
        self.weights = weights
        self.k = k

    def invoke(self, query: str):
        bm25_docs = self.bm25.invoke(query)
        dense_docs = self.dense.invoke(query)

        # Build score map using RRF: score = w / (rank + 60)
        scores = {}
        doc_map = {}
        for rank, doc in enumerate(bm25_docs[:self.k]):
            key = doc.page_content[:100]
            scores[key] = scores.get(key, 0) + self.weights[0] / (rank + 60)
            doc_map[key] = doc
        for rank, doc in enumerate(dense_docs[:self.k]):
            key = doc.page_content[:100]
            scores[key] = scores.get(key, 0) + self.weights[1] / (rank + 60)
            doc_map[key] = doc

        ranked = sorted(scores.keys(), key=lambda k: scores[k], reverse=True)
        return [doc_map[k] for k in ranked[:self.k]]


logger = logging.getLogger(__name__)

# Global variables
vectorstore = None
bm25_retriever = None
ensemble_retriever = None
cross_encoder = None
qa_llm = None
docs_list = [] # Store raw documents to reconstruct BM25 index on the fly

def init_rag_pipeline():
    global vectorstore, bm25_retriever, ensemble_retriever, cross_encoder, qa_llm, docs_list
    try:
        logger.info("Initializing Advanced Hybrid RAG Pipeline...")
        
        # 1. Load baseline documents
        doc_path = os.path.join(os.path.dirname(__file__), 'docs', 'airline_policies.txt')
        if not os.path.exists(doc_path):
            logger.error(f"Baseline document not found at {doc_path}")
            return False
            
        loader = TextLoader(doc_path, encoding='utf-8')
        documents = loader.load()
        
        # 2. Split Document into clean chunks
        text_splitter = CharacterTextSplitter(chunk_size=400, chunk_overlap=40)
        docs_list = text_splitter.split_documents(documents)
        logger.info(f"Split baseline document into {len(docs_list)} chunks.")

        # 3. Embeddings & Dense Vector Store
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vectorstore = FAISS.from_documents(docs_list, embeddings)
        dense_retriever = vectorstore.as_retriever(search_kwargs={"k": 8})

        # 4. Sparse Retriever (BM25)
        bm25_retriever = BM25Retriever.from_documents(docs_list)
        bm25_retriever.k = 8

        # 5. Hybrid Search (BM25 sparse + FAISS dense via RRF)
        ensemble_retriever = HybridRetriever(
            bm25=bm25_retriever,
            dense=dense_retriever,
            weights=(0.3, 0.7),
            k=8
        )

        # 6. Cross-Encoder Reranker
        logger.info("Loading Cross-Encoder Reranker (ms-marco-MiniLM-L-6-v2)...")
        cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

        # 7. Local Generator LLM (SmolLM-135M)
        logger.info("Loading local LLM (SmolLM-135M-Instruct)...")
        hf_pipeline = pipeline(
            "text-generation",
            model="HuggingFaceTB/SmolLM-135M-Instruct",
            max_new_tokens=150,
            truncation=True
        )
        qa_llm = HuggingFacePipeline(pipeline=hf_pipeline)
        
        logger.info("Advanced RAG Pipeline initialized successfully with Hybrid search + Cross-Encoder reranking!")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Advanced RAG: {e}")
        return False

def add_document_to_rag(file_path: str):
    """
    Dynamically indexes a new document (PDF, TXT, MD) into FAISS and recreates the BM25 index on the fly.
    """
    global vectorstore, bm25_retriever, ensemble_retriever, docs_list
    if vectorstore is None:
        init_rag_pipeline()

    try:
        logger.info(f"Dynamically indexing new document: {file_path}")
        if file_path.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
        else:
            loader = TextLoader(file_path, encoding='utf-8')
            
        new_docs = loader.load()
        text_splitter = CharacterTextSplitter(chunk_size=400, chunk_overlap=40)
        new_chunks = text_splitter.split_documents(new_docs)

        # Add to dense vector store (FAISS)
        vectorstore.add_documents(new_chunks)

        # Add to document list and rebuild sparse retriever (BM25)
        docs_list.extend(new_chunks)
        bm25_retriever = BM25Retriever.from_documents(docs_list)
        bm25_retriever.k = 8

        # Re-assemble hybrid retriever
        dense_retriever = vectorstore.as_retriever(search_kwargs={"k": 8})
        ensemble_retriever = HybridRetriever(
            bm25=bm25_retriever,
            dense=dense_retriever,
            weights=(0.3, 0.7),
            k=8
        )
        
        logger.info(f"Successfully added {len(new_chunks)} chunks to hybrid RAG store.")
        return True
    except Exception as e:
        logger.error(f"Failed to add document to RAG: {e}")
        return False

def ask_question(question: str):
    global ensemble_retriever, cross_encoder, qa_llm
    if ensemble_retriever is None or cross_encoder is None or qa_llm is None:
        return "SkyPredict AI Policy Assistant is currently initializing (downloading neural models from HuggingFace). Please wait a minute and try again.", []
            
    try:
        # Retrieve candidate passages (Hybrid Search)
        logger.info(f"Running Hybrid Search query: {question}")
        candidates = ensemble_retriever.invoke(question)
        
        if not candidates:
            return "I couldn't find any relevant policy information to answer your question.", []

        # Rerank candidates using sentence-transformers Cross-Encoder
        logger.info(f"Reranking {len(candidates)} candidates using Cross-Encoder...")
        pairs = [[question, doc.page_content] for doc in candidates]
        scores = cross_encoder.predict(pairs)
        
        # Rank from highest score to lowest
        ranked_indices = np.argsort(scores)[::-1]
        top_indices = ranked_indices[:2] # Top 2 most relevant chunks
        
        reranked_docs = [candidates[idx] for idx in top_indices]
        
        # Assemble context
        context = "\n\n".join(doc.page_content for doc in reranked_docs)
        
        # Prompt construction
        prompt = f"<|im_start|>system\nUse the policy context to answer the user question precisely. If the context does not contain the answer, say you don't know.<|im_end|>\n<|im_start|>context\n{context}<|im_end|>\n<|im_start|>user\n{question}<|im_end|>\n<|im_start|>assistant\n"
        
        logger.info("Running text generation...")
        answer = qa_llm.invoke(prompt)
        
        # Clean response if echoes
        if "assistant\n" in answer:
            answer = answer.split("assistant\n")[-1].strip()
            
        sources = [doc.page_content for doc in reranked_docs]
        return answer, sources
    except Exception as e:
        logger.error(f"Advanced RAG query failed: {e}")
        return f"Sorry, I encountered an error: {str(e)}", []

# Optimized top-k retrieval depth
