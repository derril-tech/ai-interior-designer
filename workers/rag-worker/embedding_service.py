#!/usr/bin/env python3
"""
Real ML-based Embedding Service using Sentence Transformers
"""

import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Optional, Tuple
import logging
import asyncio
from functools import lru_cache
import torch
from sklearn.metrics.pairwise import cosine_similarity
from rank_bm25 import BM25Okapi
import re
import json

logger = logging.getLogger(__name__)

class RealEmbeddingService:
    """Production embedding service with real ML models"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """Initialize with sentence transformer model"""
        self.model_name = model_name
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # BM25 for keyword search
        self.bm25_corpus = []
        self.bm25_model = None
        
        # Cache for embeddings
        self._embedding_cache = {}
        
    async def initialize(self):
        """Initialize the embedding model"""
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name, device=self.device)
            logger.info(f"Model loaded successfully on {self.device}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    async def encode_text(self, text: str) -> np.ndarray:
        """Generate embedding for single text"""
        if not self.model:
            await self.initialize()
        
        # Check cache first
        cache_key = hash(text)
        if cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]
        
        try:
            # Preprocess text
            cleaned_text = self._preprocess_text(text)
            
            # Generate embedding
            embedding = self.model.encode(cleaned_text, convert_to_numpy=True)
            
            # Cache result
            self._embedding_cache[cache_key] = embedding
            
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to encode text: {e}")
            # Return zero vector as fallback
            return np.zeros(384)  # MiniLM-L6-v2 dimension
    
    async def encode_batch(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for batch of texts"""
        if not self.model:
            await self.initialize()
        
        try:
            # Preprocess all texts
            cleaned_texts = [self._preprocess_text(text) for text in texts]
            
            # Generate embeddings in batch (more efficient)
            embeddings = self.model.encode(
                cleaned_texts, 
                convert_to_numpy=True,
                batch_size=32,
                show_progress_bar=len(texts) > 100
            )
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Failed to encode batch: {e}")
            # Return zero vectors as fallback
            return np.zeros((len(texts), 384))
    
    def _preprocess_text(self, text: str) -> str:
        """Preprocess text for better embeddings"""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove special characters but keep important punctuation
        text = re.sub(r'[^\w\s\-\.]', ' ', text)
        
        # Limit length (models have token limits)
        words = text.split()
        if len(words) > 200:  # Rough token limit
            text = ' '.join(words[:200])
        
        return text
    
    async def similarity_search(self, query_embedding: np.ndarray, 
                              candidate_embeddings: np.ndarray,
                              top_k: int = 10) -> List[Tuple[int, float]]:
        """Find most similar embeddings using cosine similarity"""
        
        try:
            # Ensure proper dimensions
            if query_embedding.ndim == 1:
                query_embedding = query_embedding.reshape(1, -1)
            
            # Calculate cosine similarity
            similarities = cosine_similarity(query_embedding, candidate_embeddings)[0]
            
            # Get top-k indices and scores
            top_indices = np.argsort(similarities)[::-1][:top_k]
            top_scores = similarities[top_indices]
            
            return [(int(idx), float(score)) for idx, score in zip(top_indices, top_scores)]
            
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    async def build_bm25_index(self, documents: List[str]):
        """Build BM25 index for keyword search"""
        try:
            # Tokenize documents
            tokenized_docs = []
            for doc in documents:
                # Simple tokenization
                tokens = self._preprocess_text(doc).split()
                tokenized_docs.append(tokens)
            
            # Build BM25 index
            self.bm25_model = BM25Okapi(tokenized_docs)
            self.bm25_corpus = documents
            
            logger.info(f"Built BM25 index with {len(documents)} documents")
            
        except Exception as e:
            logger.error(f"Failed to build BM25 index: {e}")
    
    async def bm25_search(self, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        """Perform BM25 keyword search"""
        if not self.bm25_model:
            logger.warning("BM25 model not initialized")
            return []
        
        try:
            # Tokenize query
            query_tokens = self._preprocess_text(query).split()
            
            # Get BM25 scores
            scores = self.bm25_model.get_scores(query_tokens)
            
            # Get top-k results
            top_indices = np.argsort(scores)[::-1][:top_k]
            top_scores = scores[top_indices]
            
            return [(int(idx), float(score)) for idx, score in zip(top_indices, top_scores)]
            
        except Exception as e:
            logger.error(f"BM25 search failed: {e}")
            return []
    
    async def hybrid_search(self, query: str, documents: List[str], 
                          document_embeddings: np.ndarray,
                          top_k: int = 10, 
                          bm25_weight: float = 0.3,
                          vector_weight: float = 0.7) -> List[Tuple[int, float, Dict]]:
        """Perform hybrid BM25 + vector search"""
        
        # Generate query embedding
        query_embedding = await self.encode_text(query)
        
        # Vector search
        vector_results = await self.similarity_search(
            query_embedding, document_embeddings, top_k=top_k*2
        )
        
        # BM25 search
        bm25_results = await self.bm25_search(query, top_k=top_k*2)
        
        # Combine scores
        combined_scores = {}
        
        # Add vector scores
        for idx, score in vector_results:
            combined_scores[idx] = {
                'vector_score': score,
                'bm25_score': 0.0,
                'combined_score': score * vector_weight
            }
        
        # Add BM25 scores
        for idx, score in bm25_results:
            if idx in combined_scores:
                combined_scores[idx]['bm25_score'] = score
                combined_scores[idx]['combined_score'] = (
                    combined_scores[idx]['vector_score'] * vector_weight +
                    score * bm25_weight
                )
            else:
                combined_scores[idx] = {
                    'vector_score': 0.0,
                    'bm25_score': score,
                    'combined_score': score * bm25_weight
                }
        
        # Sort by combined score
        sorted_results = sorted(
            combined_scores.items(),
            key=lambda x: x[1]['combined_score'],
            reverse=True
        )[:top_k]
        
        return [(idx, scores['combined_score'], scores) for idx, scores in sorted_results]
    
    async def generate_product_embeddings(self, products: List[Dict]) -> Dict[str, np.ndarray]:
        """Generate embeddings for product catalog"""
        
        product_texts = []
        product_ids = []
        
        for product in products:
            # Create rich text representation
            text_parts = []
            
            # Basic info
            text_parts.append(product.get('name', ''))
            text_parts.append(product.get('description', ''))
            text_parts.append(product.get('category', ''))
            text_parts.append(product.get('subcategory', ''))
            
            # Tags and style
            if 'tags' in product:
                text_parts.extend(product['tags'])
            
            # Materials
            if 'materials' in product:
                text_parts.extend(product['materials'])
            
            # Dimensions (as text)
            if 'dimensions' in product:
                dims = product['dimensions']
                text_parts.append(f"width {dims.get('width', 0)}cm")
                text_parts.append(f"depth {dims.get('depth', 0)}cm") 
                text_parts.append(f"height {dims.get('height', 0)}cm")
            
            # Price range
            price = product.get('price', 0)
            if price < 100:
                text_parts.append("budget affordable")
            elif price > 500:
                text_parts.append("premium expensive")
            else:
                text_parts.append("mid-range")
            
            # Combine all text
            product_text = ' '.join(filter(None, text_parts))
            product_texts.append(product_text)
            product_ids.append(product.get('id', product.get('sku', str(len(product_ids)))))
        
        # Generate embeddings in batch
        embeddings = await self.encode_batch(product_texts)
        
        # Build BM25 index
        await self.build_bm25_index(product_texts)
        
        # Return as dictionary
        return {
            product_id: embedding 
            for product_id, embedding in zip(product_ids, embeddings)
        }
    
    async def find_similar_products(self, target_product: Dict, 
                                  all_products: List[Dict],
                                  product_embeddings: Dict[str, np.ndarray],
                                  top_k: int = 5) -> List[Tuple[Dict, float]]:
        """Find products similar to target product"""
        
        target_id = target_product.get('id', target_product.get('sku'))
        if target_id not in product_embeddings:
            return []
        
        target_embedding = product_embeddings[target_id]
        
        # Get all other embeddings
        other_products = [p for p in all_products if p.get('id', p.get('sku')) != target_id]
        other_embeddings = []
        other_ids = []
        
        for product in other_products:
            prod_id = product.get('id', product.get('sku'))
            if prod_id in product_embeddings:
                other_embeddings.append(product_embeddings[prod_id])
                other_ids.append(prod_id)
        
        if not other_embeddings:
            return []
        
        other_embeddings = np.array(other_embeddings)
        
        # Find most similar
        similar_results = await self.similarity_search(
            target_embedding, other_embeddings, top_k=top_k
        )
        
        # Map back to products
        similar_products = []
        for idx, score in similar_results:
            if idx < len(other_products):
                similar_products.append((other_products[idx], score))
        
        return similar_products
    
    def get_model_info(self) -> Dict:
        """Get information about loaded model"""
        if not self.model:
            return {"status": "not_loaded"}
        
        return {
            "status": "loaded",
            "model_name": self.model_name,
            "device": self.device,
            "embedding_dimension": self.model.get_sentence_embedding_dimension(),
            "max_sequence_length": self.model.max_seq_length,
            "cache_size": len(self._embedding_cache)
        }

# Global instance
_embedding_service = None

async def get_embedding_service() -> RealEmbeddingService:
    """Get singleton embedding service instance"""
    global _embedding_service
    
    if _embedding_service is None:
        _embedding_service = RealEmbeddingService()
        await _embedding_service.initialize()
    
    return _embedding_service
