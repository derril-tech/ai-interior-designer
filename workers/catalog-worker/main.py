#!/usr/bin/env python3
"""
Catalog Worker - Ingests vendor product feeds and maintains product database
"""

import asyncio
import json
import logging
import os
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

import nats
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import httpx
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Catalog Worker",
    description="Ingests vendor product feeds and maintains product database",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class CatalogJob(BaseModel):
    id: str
    vendor: str
    feed_url: Optional[str] = None
    feed_type: str = "api"  # api, csv, xml, scrape
    categories: List[str] = []
    update_mode: str = "incremental"  # full, incremental

class CatalogResult(BaseModel):
    job_id: str
    vendor: str
    status: str
    products_processed: int = 0
    products_added: int = 0
    products_updated: int = 0
    products_removed: int = 0
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

async def process_catalog_job(job_data: Dict[str, Any]) -> CatalogResult:
    """Process catalog ingestion job"""
    job_id = job_data.get("id")
    vendor = job_data.get("vendor")
    feed_url = job_data.get("feed_url")
    feed_type = job_data.get("feed_type", "api")
    categories = job_data.get("categories", [])
    
    try:
        await update_job_progress(job_id, 0.1, f"Starting {vendor} catalog ingestion")
        
        # Step 1: Fetch product data
        if vendor.lower() == "ikea":
            products = await fetch_ikea_products(categories)
        elif vendor.lower() == "wayfair":
            products = await fetch_wayfair_products(categories)
        else:
            products = await fetch_generic_products(feed_url, feed_type)
        
        await update_job_progress(job_id, 0.4, f"Processing {len(products)} products")
        
        # Step 2: Process and enrich products
        processed_products = []
        for i, product in enumerate(products):
            enriched_product = await enrich_product_data(product, vendor)
            processed_products.append(enriched_product)
            
            # Update progress
            if i % 50 == 0:
                progress = 0.4 + (i / len(products)) * 0.4
                await update_job_progress(job_id, progress, f"Processed {i}/{len(products)} products")
        
        await update_job_progress(job_id, 0.8, "Updating product database")
        
        # Step 3: Update database
        stats = await update_product_database(processed_products, vendor)
        
        await update_job_progress(job_id, 1.0, "Catalog ingestion complete")
        
        return CatalogResult(
            job_id=job_id,
            vendor=vendor,
            status="completed",
            products_processed=len(processed_products),
            products_added=stats["added"],
            products_updated=stats["updated"],
            products_removed=stats["removed"],
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error processing catalog job {job_id}: {e}")
        return CatalogResult(
            job_id=job_id,
            vendor=vendor,
            status="failed",
            error=str(e),
            progress=0.0
        )

async def fetch_ikea_products(categories: List[str]) -> List[Dict[str, Any]]:
    """Fetch IKEA product data (mock implementation)"""
    await asyncio.sleep(1.0)  # Simulate API call
    
    # Mock IKEA product data
    ikea_products = [
        {
            "sku": "90360419",
            "name": "KIVIK Three-seat sofa",
            "category": "seating",
            "subcategory": "sofas",
            "description": "A generous seating series with a soft, deep seat and comfortable support for your back.",
            "price": 799.00,
            "currency": "USD",
            "dimensions": {
                "width": 228,
                "depth": 95,
                "height": 83,
                "seat_height": 45
            },
            "materials": ["fabric", "wood", "metal"],
            "colors": ["beige", "dark gray", "light gray"],
            "weight_kg": 85,
            "assembly_required": True,
            "care_instructions": "Vacuum regularly. Professional cleaning recommended.",
            "warranty_years": 10,
            "sustainability_info": "Renewable materials",
            "stock_status": "in_stock",
            "lead_time_days": 7,
            "images": [
                "https://www.ikea.com/us/en/images/products/kivik-three-seat-sofa__0603932_pe681583_s5.jpg"
            ],
            "product_url": "https://www.ikea.com/us/en/p/kivik-three-seat-sofa-90360419/",
            "tags": ["modern", "comfortable", "family-friendly"]
        },
        {
            "sku": "70360420",
            "name": "HEMNES Coffee table",
            "category": "tables",
            "subcategory": "coffee_tables",
            "description": "Solid wood coffee table with practical storage space underneath.",
            "price": 249.99,
            "currency": "USD",
            "dimensions": {
                "width": 118,
                "depth": 75,
                "height": 46
            },
            "materials": ["solid_pine", "stain", "clear_lacquer"],
            "colors": ["white_stain", "black_brown"],
            "weight_kg": 32,
            "assembly_required": True,
            "care_instructions": "Wipe clean with a damp cloth.",
            "warranty_years": 5,
            "sustainability_info": "FSC certified wood",
            "stock_status": "in_stock",
            "lead_time_days": 3,
            "images": [
                "https://www.ikea.com/us/en/images/products/hemnes-coffee-table__0603933_pe681584_s5.jpg"
            ],
            "product_url": "https://www.ikea.com/us/en/p/hemnes-coffee-table-70360420/",
            "tags": ["traditional", "storage", "solid_wood"]
        },
        {
            "sku": "40360421",
            "name": "POÄNG Armchair",
            "category": "seating",
            "subcategory": "armchairs",
            "description": "Comfortable armchair with layer-glued bent birch frame.",
            "price": 149.00,
            "currency": "USD",
            "dimensions": {
                "width": 68,
                "depth": 82,
                "height": 100,
                "seat_height": 42
            },
            "materials": ["birch_veneer", "fabric"],
            "colors": ["birch_veneer", "white"],
            "weight_kg": 12,
            "assembly_required": True,
            "care_instructions": "Machine wash cushion cover at 40°C.",
            "warranty_years": 10,
            "sustainability_info": "Renewable materials",
            "stock_status": "in_stock",
            "lead_time_days": 5,
            "images": [
                "https://www.ikea.com/us/en/images/products/poang-armchair__0603934_pe681585_s5.jpg"
            ],
            "product_url": "https://www.ikea.com/us/en/p/poang-armchair-40360421/",
            "tags": ["modern", "comfortable", "iconic"]
        },
        {
            "sku": "80360422",
            "name": "MALM Desk",
            "category": "desks",
            "subcategory": "office_desks",
            "description": "Simple desk with pull-out panel for extra workspace when needed.",
            "price": 179.00,
            "currency": "USD",
            "dimensions": {
                "width": 151,
                "depth": 65,
                "height": 73
            },
            "materials": ["particleboard", "foil", "plastic"],
            "colors": ["white", "black_brown"],
            "weight_kg": 43,
            "assembly_required": True,
            "care_instructions": "Wipe clean with a damp cloth.",
            "warranty_years": 5,
            "sustainability_info": "Recycled materials",
            "stock_status": "in_stock",
            "lead_time_days": 7,
            "images": [
                "https://www.ikea.com/us/en/images/products/malm-desk__0603935_pe681586_s5.jpg"
            ],
            "product_url": "https://www.ikea.com/us/en/p/malm-desk-80360422/",
            "tags": ["modern", "minimalist", "workspace"]
        },
        {
            "sku": "60360423",
            "name": "HEMNES TV bench",
            "category": "storage",
            "subcategory": "tv_stands",
            "description": "TV bench with open compartments and cable management.",
            "price": 299.00,
            "currency": "USD",
            "dimensions": {
                "width": 148,
                "depth": 47,
                "height": 57
            },
            "materials": ["solid_pine", "stain"],
            "colors": ["white_stain", "black_brown"],
            "weight_kg": 45,
            "assembly_required": True,
            "care_instructions": "Wipe clean with a damp cloth.",
            "warranty_years": 5,
            "sustainability_info": "FSC certified wood",
            "stock_status": "in_stock",
            "lead_time_days": 10,
            "images": [
                "https://www.ikea.com/us/en/images/products/hemnes-tv-bench__0603936_pe681587_s5.jpg"
            ],
            "product_url": "https://www.ikea.com/us/en/p/hemnes-tv-bench-60360423/",
            "tags": ["traditional", "storage", "entertainment"]
        }
    ]
    
    # Filter by categories if specified
    if categories:
        ikea_products = [p for p in ikea_products if p["category"] in categories]
    
    return ikea_products

async def fetch_wayfair_products(categories: List[str]) -> List[Dict[str, Any]]:
    """Fetch Wayfair product data (mock implementation)"""
    await asyncio.sleep(0.8)  # Simulate API call
    
    # Mock Wayfair product data
    wayfair_products = [
        {
            "sku": "W001234567",
            "name": "Foundstone™ Adaline Coffee Table",
            "category": "tables",
            "subcategory": "coffee_tables",
            "description": "Modern coffee table with clean lines and storage shelf.",
            "price": 249.99,
            "currency": "USD",
            "dimensions": {
                "width": 120,
                "depth": 60,
                "height": 45
            },
            "materials": ["engineered_wood", "metal"],
            "colors": ["walnut", "white", "black"],
            "weight_kg": 25,
            "assembly_required": True,
            "care_instructions": "Dust regularly with soft cloth.",
            "warranty_years": 1,
            "sustainability_info": "GREENGUARD Gold certified",
            "stock_status": "in_stock",
            "lead_time_days": 14,
            "images": [
                "https://secure.img1-cg.wfcdn.com/im/12345678/resize-h800-w800%5Ecompr-r85/1234/adaline-coffee-table.jpg"
            ],
            "product_url": "https://www.wayfair.com/furniture/pdp/foundstone-adaline-coffee-table-w001234567.html",
            "tags": ["modern", "storage", "metal_legs"]
        },
        {
            "sku": "W001234568",
            "name": "Mercury Row® Zipcode Design Sectional Sofa",
            "category": "seating",
            "subcategory": "sectionals",
            "description": "Contemporary sectional sofa with reversible chaise.",
            "price": 899.99,
            "currency": "USD",
            "dimensions": {
                "width": 240,
                "depth": 160,
                "height": 85,
                "seat_height": 48
            },
            "materials": ["fabric", "wood_frame", "foam"],
            "colors": ["charcoal", "navy", "beige"],
            "weight_kg": 95,
            "assembly_required": True,
            "care_instructions": "Spot clean only.",
            "warranty_years": 2,
            "sustainability_info": "CertiPUR-US certified foam",
            "stock_status": "in_stock",
            "lead_time_days": 21,
            "images": [
                "https://secure.img1-cg.wfcdn.com/im/12345679/resize-h800-w800%5Ecompr-r85/1234/sectional-sofa.jpg"
            ],
            "product_url": "https://www.wayfair.com/furniture/pdp/mercury-row-sectional-sofa-w001234568.html",
            "tags": ["contemporary", "sectional", "reversible"]
        }
    ]
    
    # Filter by categories if specified
    if categories:
        wayfair_products = [p for p in wayfair_products if p["category"] in categories]
    
    return wayfair_products

async def fetch_generic_products(feed_url: str, feed_type: str) -> List[Dict[str, Any]]:
    """Fetch products from generic feed"""
    await asyncio.sleep(0.5)
    
    # Mock generic product fetch
    return []

async def enrich_product_data(product: Dict[str, Any], vendor: str) -> Dict[str, Any]:
    """Enrich product data with additional metadata"""
    
    # Add vendor-specific enrichments
    enriched = product.copy()
    enriched["vendor"] = vendor
    enriched["last_updated"] = datetime.utcnow().isoformat()
    
    # Generate embeddings placeholder (in real implementation, use sentence transformers)
    enriched["search_text"] = f"{product['name']} {product.get('description', '')} {' '.join(product.get('tags', []))}"
    enriched["embedding_vector"] = [0.1] * 768  # Mock 768-dimensional embedding
    
    # Standardize dimensions to centimeters
    dims = product.get("dimensions", {})
    enriched["dimensions_cm"] = {
        "width": dims.get("width", 100),
        "depth": dims.get("depth", 50),
        "height": dims.get("height", 80)
    }
    
    # Calculate clearance requirements based on category
    category = product.get("category", "")
    if category == "seating":
        enriched["clearances_cm"] = {"front": 80, "back": 30, "sides": 30}
    elif category == "tables":
        enriched["clearances_cm"] = {"all": 40}
    elif category == "storage":
        enriched["clearances_cm"] = {"front": 50, "back": 10, "sides": 20}
    else:
        enriched["clearances_cm"] = {"all": 30}
    
    # Add placement rules
    if category == "seating":
        enriched["placement_rules"] = ["against_wall", "room_center", "conversation_group"]
    elif category == "tables" and "coffee" in product["name"].lower():
        enriched["placement_rules"] = ["sofa_front", "room_center"]
    elif category == "desks":
        enriched["placement_rules"] = ["against_wall", "window_adjacent"]
    elif "tv" in product["name"].lower():
        enriched["placement_rules"] = ["against_wall", "tv_viewing"]
    else:
        enriched["placement_rules"] = ["against_wall"]
    
    # Add style scoring
    tags = product.get("tags", [])
    enriched["style_scores"] = {
        "modern": 0.8 if "modern" in tags else 0.2,
        "traditional": 0.8 if "traditional" in tags else 0.2,
        "minimalist": 0.8 if "minimalist" in tags else 0.2,
        "industrial": 0.8 if "industrial" in tags else 0.1,
        "scandinavian": 0.9 if vendor.lower() == "ikea" else 0.3
    }
    
    return enriched

async def update_product_database(products: List[Dict[str, Any]], vendor: str) -> Dict[str, int]:
    """Update product database with new/updated products"""
    await asyncio.sleep(0.5)  # Simulate database operations
    
    # Mock database update statistics
    stats = {
        "added": len([p for p in products if p.get("stock_status") == "in_stock"]),
        "updated": len(products) // 4,  # Assume 25% are updates
        "removed": 0  # No removals in this batch
    }
    
    # In real implementation, would use SQLAlchemy or similar to update PostgreSQL
    logger.info(f"Updated {vendor} catalog: {stats}")
    
    return stats

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

async def catalog_job_handler(msg):
    """Handle incoming catalog jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received catalog job: {job_data.get('id')}")
        
        result = await process_catalog_job(job_data)
        
        if nats_client:
            await nats_client.publish(
                "catalog.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling catalog job: {e}")

@app.on_event("startup")
async def startup_event():
    await connect_services()
    if nats_client:
        await nats_client.subscribe("catalog.jobs", cb=catalog_job_handler)
        logger.info("Subscribed to catalog.jobs")

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

@app.post("/sync/{vendor}")
async def sync_vendor_catalog(vendor: str, categories: List[str] = None):
    """Manually trigger vendor catalog sync"""
    job_id = f"manual_sync_{vendor}_{int(asyncio.get_event_loop().time())}"
    
    job_data = {
        "id": job_id,
        "vendor": vendor,
        "categories": categories or [],
        "update_mode": "incremental"
    }
    
    if nats_client:
        await nats_client.publish(
            "catalog.jobs",
            json.dumps(job_data).encode()
        )
    
    return {"job_id": job_id, "message": f"Catalog sync initiated for {vendor}"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8006)),
        reload=True
    )
