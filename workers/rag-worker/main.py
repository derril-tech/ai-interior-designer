#!/usr/bin/env python3
"""
RAG Worker - Handles product search and citation generation
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, List

import nats
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG Worker",
    description="Handles product search and citation generation",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class RAGJob(BaseModel):
    id: str
    query: str
    room_context: Optional[Dict[str, Any]] = None
    style_prefs: List[str] = []
    budget_range: Optional[Dict[str, int]] = None

class RAGResult(BaseModel):
    job_id: str
    status: str
    results: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    progress: float = 0.0

async def connect_services():
    """Connect to NATS and Redis"""
    global nats_client, redis_client
    
    nats_url = os.getenv("NATS_URL", "nats://localhost:4222")
    nats_client = await nats.connect(nats_url)
    logger.info(f"Connected to NATS at {nats_url}")
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url)
    logger.info(f"Connected to Redis at {redis_url}")

async def search_products(job_data: Dict[str, Any]) -> RAGResult:
    """Search products using hybrid RAG (BM25 + embeddings)"""
    job_id = job_data.get("id")
    query = job_data.get("query", "")
    room_context = job_data.get("room_context", {})
    style_prefs = job_data.get("style_prefs", [])
    budget_range = job_data.get("budget_range", {})
    
    try:
        await update_job_progress(job_id, 0.1, "Analyzing search query")
        
        # Step 1: Parse and expand query
        expanded_query = await expand_search_query(query, room_context, style_prefs)
        
        await update_job_progress(job_id, 0.2, "Generating query embeddings")
        
        # Step 2: Generate embeddings for semantic search
        query_embedding = await generate_query_embedding(expanded_query)
        
        await update_job_progress(job_id, 0.4, "Performing hybrid search")
        
        # Step 3: Hybrid search (BM25 + vector similarity)
        bm25_results = await bm25_search(expanded_query, limit=50)
        vector_results = await vector_search(query_embedding, limit=50)
        
        await update_job_progress(job_id, 0.6, "Ranking and filtering results")
        
        # Step 4: Combine and rank results
        combined_results = await combine_search_results(bm25_results, vector_results, room_context, style_prefs, budget_range)
        
        await update_job_progress(job_id, 0.8, "Generating citations")
        
        # Step 5: Generate citations and explanations
        final_results = []
        for result in combined_results[:10]:  # Top 10 results
            citation = await generate_product_citation(result, query, room_context)
            result["citation"] = citation
            final_results.append(result)
        
        await update_job_progress(job_id, 1.0, "Search complete")
        
        return RAGResult(
            job_id=job_id,
            status="completed",
            results=final_results,
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error searching products for job {job_id}: {e}")
        return RAGResult(
            job_id=job_id,
            status="failed",
            error=str(e),
            progress=0.0
        )

async def expand_search_query(query: str, room_context: Dict, style_prefs: List[str]) -> str:
    """Expand search query with room context and style preferences"""
    await asyncio.sleep(0.1)
    
    expanded_terms = [query]
    
    # Add room context
    if room_context:
        area_sqm = room_context.get("area_sqm", 0)
        if area_sqm < 15:
            expanded_terms.append("small space compact")
        elif area_sqm > 30:
            expanded_terms.append("large spacious")
        
        # Add room type context
        room_type = room_context.get("type", "living_room")
        expanded_terms.append(room_type.replace("_", " "))
    
    # Add style preferences
    if style_prefs:
        expanded_terms.extend(style_prefs)
    
    return " ".join(expanded_terms)

async def generate_query_embedding(query: str) -> List[float]:
    """Generate embedding vector for search query"""
    await asyncio.sleep(0.2)
    
    # Mock embedding generation - in real implementation, use sentence-transformers
    # e.g., model = SentenceTransformer('all-MiniLM-L6-v2')
    # embedding = model.encode(query)
    
    # Generate mock 768-dimensional embedding based on query hash
    import hashlib
    query_hash = hashlib.md5(query.encode()).hexdigest()
    
    # Convert hash to pseudo-random embedding
    embedding = []
    for i in range(768):
        char_val = ord(query_hash[i % len(query_hash)])
        normalized_val = (char_val - 48) / 74.0  # Normalize to roughly [-1, 1]
        embedding.append(normalized_val)
    
    return embedding

async def bm25_search(query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Perform BM25 text search on product catalog"""
    await asyncio.sleep(0.3)
    
    # Mock BM25 search results - in real implementation, use Elasticsearch or similar
    mock_products = await get_mock_product_database()
    
    # Simple keyword matching for mock
    query_terms = query.lower().split()
    scored_products = []
    
    for product in mock_products:
        score = 0.0
        search_text = f"{product['name']} {product.get('description', '')} {' '.join(product.get('tags', []))}".lower()
        
        for term in query_terms:
            if term in search_text:
                # Simple TF scoring
                tf = search_text.count(term)
                score += tf * 0.1
        
        if score > 0:
            product_copy = product.copy()
            product_copy["bm25_score"] = score
            scored_products.append(product_copy)
    
    # Sort by BM25 score
    scored_products.sort(key=lambda x: x["bm25_score"], reverse=True)
    return scored_products[:limit]

async def vector_search(query_embedding: List[float], limit: int = 50) -> List[Dict[str, Any]]:
    """Perform vector similarity search"""
    await asyncio.sleep(0.4)
    
    # Mock vector search - in real implementation, use pgvector or Pinecone
    mock_products = await get_mock_product_database()
    
    scored_products = []
    for product in mock_products:
        # Mock similarity calculation
        product_embedding = product.get("embedding_vector", [0.0] * 768)
        
        # Cosine similarity (simplified)
        dot_product = sum(a * b for a, b in zip(query_embedding[:len(product_embedding)], product_embedding))
        magnitude_q = sum(a * a for a in query_embedding[:len(product_embedding)]) ** 0.5
        magnitude_p = sum(a * a for a in product_embedding) ** 0.5
        
        if magnitude_q > 0 and magnitude_p > 0:
            similarity = dot_product / (magnitude_q * magnitude_p)
        else:
            similarity = 0.0
        
        product_copy = product.copy()
        product_copy["vector_score"] = max(0.0, similarity)
        scored_products.append(product_copy)
    
    # Sort by vector similarity
    scored_products.sort(key=lambda x: x["vector_score"], reverse=True)
    return scored_products[:limit]

async def combine_search_results(bm25_results: List[Dict], vector_results: List[Dict], 
                               room_context: Dict, style_prefs: List[str], budget_range: Dict) -> List[Dict[str, Any]]:
    """Combine BM25 and vector search results with additional filtering"""
    await asyncio.sleep(0.2)
    
    # Create combined scoring
    product_scores = {}
    
    # Add BM25 scores (weight: 0.4)
    for i, product in enumerate(bm25_results):
        product_id = product["sku"]
        rank_score = (len(bm25_results) - i) / len(bm25_results)  # Position-based score
        bm25_score = product.get("bm25_score", 0.0)
        product_scores[product_id] = {
            "product": product,
            "bm25_score": bm25_score * 0.4,
            "bm25_rank": rank_score * 0.2
        }
    
    # Add vector scores (weight: 0.4)
    for i, product in enumerate(vector_results):
        product_id = product["sku"]
        rank_score = (len(vector_results) - i) / len(vector_results)
        vector_score = product.get("vector_score", 0.0)
        
        if product_id in product_scores:
            product_scores[product_id]["vector_score"] = vector_score * 0.4
            product_scores[product_id]["vector_rank"] = rank_score * 0.2
        else:
            product_scores[product_id] = {
                "product": product,
                "bm25_score": 0.0,
                "bm25_rank": 0.0,
                "vector_score": vector_score * 0.4,
                "vector_rank": rank_score * 0.2
            }
    
    # Apply additional scoring factors
    for product_id, scores in product_scores.items():
        product = scores["product"]
        
        # Style preference bonus
        style_bonus = 0.0
        if style_prefs:
            product_styles = product.get("style_scores", {})
            for style in style_prefs:
                style_bonus += product_styles.get(style, 0.0) * 0.1
        
        # Room size compatibility
        room_bonus = 0.0
        if room_context:
            area_sqm = room_context.get("area_sqm", 20.0)
            product_area = (product.get("dimensions_cm", {}).get("width", 100) * 
                          product.get("dimensions_cm", {}).get("depth", 50)) / 10000  # Convert to m²
            
            if area_sqm < 15 and product_area < 2.0:  # Small room, small furniture
                room_bonus = 0.1
            elif area_sqm > 25 and product_area > 1.5:  # Large room, larger furniture
                room_bonus = 0.1
        
        # Budget compatibility
        budget_bonus = 0.0
        if budget_range:
            min_budget = budget_range.get("min_cents", 0)
            max_budget = budget_range.get("max_cents", float('inf'))
            product_price = product.get("price", 0) * 100  # Convert to cents
            
            if min_budget <= product_price <= max_budget:
                budget_bonus = 0.1
        
        # Stock availability bonus
        stock_bonus = 0.1 if product.get("stock_status") == "in_stock" else 0.0
        
        # Calculate final score
        scores["final_score"] = (
            scores.get("bm25_score", 0.0) +
            scores.get("bm25_rank", 0.0) +
            scores.get("vector_score", 0.0) +
            scores.get("vector_rank", 0.0) +
            style_bonus +
            room_bonus +
            budget_bonus +
            stock_bonus
        )
    
    # Sort by final score and return products
    sorted_products = sorted(product_scores.values(), key=lambda x: x["final_score"], reverse=True)
    
    # Enrich with final scores and return
    results = []
    for item in sorted_products:
        product = item["product"]
        product["relevance_score"] = round(item["final_score"], 3)
        product["score_breakdown"] = {
            "bm25": round(item.get("bm25_score", 0.0), 3),
            "vector": round(item.get("vector_score", 0.0), 3),
            "style_match": round(style_bonus, 3),
            "room_fit": round(room_bonus, 3),
            "budget_fit": round(budget_bonus, 3)
        }
        results.append(product)
    
    return results

async def generate_product_citation(product: Dict[str, Any], query: str, room_context: Dict) -> str:
    """Generate explanatory citation for why product was recommended"""
    await asyncio.sleep(0.05)
    
    name = product.get("name", "Product")
    category = product.get("category", "")
    dimensions = product.get("dimensions_cm", {})
    style_scores = product.get("style_scores", {})
    
    citations = []
    
    # Relevance to query
    if query.lower() in name.lower():
        citations.append(f"Directly matches '{query}' search")
    
    # Room compatibility
    if room_context:
        area_sqm = room_context.get("area_sqm", 0)
        if area_sqm > 0:
            product_area = (dimensions.get("width", 100) * dimensions.get("depth", 50)) / 10000
            if area_sqm < 15 and product_area < 2.0:
                citations.append("Sized appropriately for smaller rooms")
            elif area_sqm > 25 and product_area > 1.5:
                citations.append("Well-suited for spacious rooms")
    
    # Style compatibility
    top_style = max(style_scores.items(), key=lambda x: x[1]) if style_scores else None
    if top_style and top_style[1] > 0.7:
        citations.append(f"Excellent {top_style[0]} style match")
    
    # Functional benefits
    if category == "seating":
        citations.append("Provides comfortable seating with proper clearances")
    elif category == "tables" and "coffee" in name.lower():
        citations.append("Perfect scale for coffee table placement")
    elif category == "storage":
        citations.append("Offers practical storage while maintaining room flow")
    
    # Quality indicators
    if product.get("warranty_years", 0) >= 5:
        citations.append(f"{product['warranty_years']}-year warranty indicates quality construction")
    
    if product.get("sustainability_info"):
        citations.append("Meets sustainability standards")
    
    # Stock and delivery
    if product.get("stock_status") == "in_stock":
        lead_time = product.get("lead_time_days", 0)
        if lead_time <= 7:
            citations.append("Available for quick delivery")
    
    # Combine citations
    if citations:
        return ". ".join(citations[:3]) + "."  # Limit to top 3 reasons
    else:
        return f"Recommended {category} option that fits your space and style preferences."

async def get_mock_product_database() -> List[Dict[str, Any]]:
    """Get mock product database for testing"""
    # This would normally query the actual product database
    return [
        {
            "sku": "90360419",
            "name": "KIVIK Three-seat sofa",
            "vendor": "IKEA",
            "category": "seating",
            "subcategory": "sofas",
            "description": "A generous seating series with a soft, deep seat and comfortable support for your back.",
            "price": 799.00,
            "currency": "USD",
            "dimensions_cm": {"width": 228, "depth": 95, "height": 83},
            "tags": ["modern", "comfortable", "family-friendly"],
            "style_scores": {"modern": 0.8, "traditional": 0.6, "minimalist": 0.4},
            "stock_status": "in_stock",
            "lead_time_days": 7,
            "warranty_years": 10,
            "sustainability_info": "Renewable materials",
            "product_url": "https://www.ikea.com/us/en/p/kivik-three-seat-sofa-90360419/",
            "embedding_vector": [0.1] * 768
        },
        {
            "sku": "70360420",
            "name": "HEMNES Coffee table",
            "vendor": "IKEA",
            "category": "tables",
            "subcategory": "coffee_tables",
            "description": "Solid wood coffee table with practical storage space underneath.",
            "price": 249.99,
            "currency": "USD",
            "dimensions_cm": {"width": 118, "depth": 75, "height": 46},
            "tags": ["traditional", "storage", "solid_wood"],
            "style_scores": {"modern": 0.4, "traditional": 0.9, "minimalist": 0.3},
            "stock_status": "in_stock",
            "lead_time_days": 3,
            "warranty_years": 5,
            "sustainability_info": "FSC certified wood",
            "product_url": "https://www.ikea.com/us/en/p/hemnes-coffee-table-70360420/",
            "embedding_vector": [0.2] * 768
        },
        {
            "sku": "W001234567",
            "name": "Foundstone™ Adaline Coffee Table",
            "vendor": "Wayfair",
            "category": "tables",
            "subcategory": "coffee_tables",
            "description": "Modern coffee table with clean lines and storage shelf.",
            "price": 249.99,
            "currency": "USD",
            "dimensions_cm": {"width": 120, "depth": 60, "height": 45},
            "tags": ["modern", "storage", "metal_legs"],
            "style_scores": {"modern": 0.9, "traditional": 0.2, "minimalist": 0.8},
            "stock_status": "in_stock",
            "lead_time_days": 14,
            "warranty_years": 1,
            "sustainability_info": "GREENGUARD Gold certified",
            "product_url": "https://www.wayfair.com/furniture/pdp/foundstone-adaline-coffee-table-w001234567.html",
            "embedding_vector": [0.3] * 768
        }
    ]

async def update_job_progress(job_id: str, progress: float, message: str):
    """Update job progress in Redis"""
    if redis_client:
        progress_data = {
            "job_id": job_id,
            "progress": progress,
            "message": message,
            "timestamp": asyncio.get_event_loop().time()
        }
        await redis_client.xadd(f"job_progress:{job_id}", progress_data)

async def rag_job_handler(msg):
    """Handle incoming RAG jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received RAG job: {job_data.get('id')}")
        
        result = await search_products(job_data)
        
        if nats_client:
            await nats_client.publish(
                "rag.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling RAG job: {e}")

@app.on_event("startup")
async def startup_event():
    await connect_services()
    if nats_client:
        await nats_client.subscribe("rag.jobs", cb=rag_job_handler)
        logger.info("Subscribed to rag.jobs")

@app.on_event("shutdown")
async def shutdown_event():
    if nats_client:
        await nats_client.close()
    if redis_client:
        await redis_client.close()

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "nats_connected": nats_client is not None and nats_client.is_connected,
        "redis_connected": redis_client is not None
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8003)),
        reload=True
    )
