#!/usr/bin/env python3
"""
Export Worker - Generates PDF layouts and BOM CSV/JSON exports
"""

import asyncio
import json
import logging
import os
import csv
from typing import Dict, Any, Optional, List
from datetime import datetime
import tempfile
from pathlib import Path

import nats
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import pandas as pd
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing, Rect, Circle, Line
from reportlab.graphics import renderPDF
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_pdf import PdfPages

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Export Worker",
    description="Generates PDF layouts and BOM CSV/JSON exports",
    version="1.0.0"
)

# Global connections
nats_client: Optional[nats.NATS] = None
redis_client: Optional[redis.Redis] = None

class ExportJob(BaseModel):
    id: str
    layout_id: str
    room_id: str
    layout_data: Dict[str, Any]
    room_data: Dict[str, Any]
    export_types: List[str] = ["pdf", "bom"]
    options: Dict[str, Any] = {}

class ExportResult(BaseModel):
    job_id: str
    layout_id: str
    status: str
    exports: Optional[Dict[str, str]] = None
    file_sizes: Optional[Dict[str, int]] = None
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

async def process_export_job(job_data: Dict[str, Any]) -> ExportResult:
    """Process export job to generate PDF and BOM files"""
    job_id = job_data.get("id")
    layout_id = job_data.get("layout_id")
    layout_data = job_data.get("layout_data", {})
    room_data = job_data.get("room_data", {})
    export_types = job_data.get("export_types", ["pdf", "bom"])
    options = job_data.get("options", {})
    
    try:
        await update_job_progress(job_id, 0.1, "Starting export generation")
        
        exports = {}
        file_sizes = {}
        
        # Generate PDF export
        if "pdf" in export_types:
            await update_job_progress(job_id, 0.3, "Generating layout PDF")
            pdf_path = await generate_layout_pdf(layout_data, room_data, options)
            pdf_url = await upload_export_to_storage(pdf_path, layout_id, "pdf")
            exports["pdf"] = pdf_url
            file_sizes["pdf"] = os.path.getsize(pdf_path) if os.path.exists(pdf_path) else 0
        
        # Generate BOM export
        if "bom" in export_types:
            await update_job_progress(job_id, 0.6, "Generating BOM export")
            bom_path = await generate_bom_export(layout_data, options)
            bom_url = await upload_export_to_storage(bom_path, layout_id, "csv")
            exports["bom"] = bom_url
            file_sizes["bom"] = os.path.getsize(bom_path) if os.path.exists(bom_path) else 0
        
        # Generate JSON export if requested
        if "json" in export_types:
            await update_job_progress(job_id, 0.8, "Generating JSON export")
            json_path = await generate_json_export(layout_data, room_data, options)
            json_url = await upload_export_to_storage(json_path, layout_id, "json")
            exports["json"] = json_url
            file_sizes["json"] = os.path.getsize(json_path) if os.path.exists(json_path) else 0
        
        await update_job_progress(job_id, 1.0, "Export generation complete")
        
        return ExportResult(
            job_id=job_id,
            layout_id=layout_id,
            status="completed",
            exports=exports,
            file_sizes=file_sizes,
            progress=1.0
        )
        
    except Exception as e:
        logger.error(f"Error processing export job {job_id}: {e}")
        return ExportResult(
            job_id=job_id,
            layout_id=layout_id,
            status="failed",
            error=str(e),
            progress=0.0
        )

async def generate_layout_pdf(layout_data: Dict[str, Any], room_data: Dict[str, Any], options: Dict[str, Any]) -> str:
    """Generate PDF layout document"""
    await asyncio.sleep(0.5)  # Simulate processing time
    
    layout_name = layout_data.get("name", "Layout")
    room_name = room_data.get("name", "Room")
    placements = layout_data.get("placements", [])
    
    # Create temporary PDF file
    pdf_path = f"/tmp/layout_{layout_data.get('id', 'unknown')}.pdf"
    
    # Create PDF document
    doc = SimpleDocTemplate(pdf_path, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#2563eb')
    )
    story.append(Paragraph(f"Interior Design Layout: {layout_name}", title_style))
    story.append(Spacer(1, 20))
    
    # Room Information
    room_info_style = ParagraphStyle(
        'RoomInfo',
        parent=styles['Normal'],
        fontSize=12,
        spaceAfter=10
    )
    
    story.append(Paragraph(f"<b>Room:</b> {room_name}", room_info_style))
    story.append(Paragraph(f"<b>Area:</b> {room_data.get('area_sqm', 0):.1f} m²", room_info_style))
    story.append(Paragraph(f"<b>Layout Score:</b> {int(layout_data.get('score', 0) * 100)}%", room_info_style))
    story.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", room_info_style))
    story.append(Spacer(1, 20))
    
    # Floor plan diagram (if requested)
    if options.get("includeFloorPlan", True):
        story.append(Paragraph("<b>Floor Plan</b>", styles['Heading2']))
        
        # Generate floor plan image
        floor_plan_path = await generate_floor_plan_image(room_data, placements)
        if floor_plan_path and os.path.exists(floor_plan_path):
            img = Image(floor_plan_path, width=400, height=300)
            story.append(img)
        
        story.append(Spacer(1, 20))
    
    # Furniture list
    story.append(Paragraph("<b>Furniture List</b>", styles['Heading2']))
    
    # Create furniture table
    table_data = [["Item", "Dimensions (cm)", "Position (m)", "Price"]]
    
    total_cost = 0
    for placement in placements:
        name = placement.get("furniture_name", "Unknown")
        dims = placement.get("dimensions", {})
        dim_str = f"{dims.get('width', 0):.0f} × {dims.get('depth', 0):.0f} × {dims.get('height', 0):.0f}"
        pos_str = f"({placement.get('x', 0):.1f}, {placement.get('y', 0):.1f})"
        price = placement.get("price_cents", 0) / 100
        price_str = f"${price:.2f}"
        total_cost += price
        
        table_data.append([name, dim_str, pos_str, price_str])
    
    # Add total row
    table_data.append(["", "", "Total:", f"${total_cost:.2f}"])
    
    table = Table(table_data, colWidths=[3*inch, 1.5*inch, 1*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
        ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(table)
    story.append(Spacer(1, 20))
    
    # Layout rationale
    if layout_data.get("rationale"):
        story.append(Paragraph("<b>Design Rationale</b>", styles['Heading2']))
        story.append(Paragraph(layout_data["rationale"], styles['Normal']))
        story.append(Spacer(1, 20))
    
    # Dimensions and specifications (if requested)
    if options.get("includeDimensions", True):
        story.append(Paragraph("<b>Detailed Specifications</b>", styles['Heading2']))
        
        for i, placement in enumerate(placements, 1):
            item_style = ParagraphStyle(
                'ItemDetail',
                parent=styles['Normal'],
                fontSize=10,
                leftIndent=20,
                spaceAfter=8
            )
            
            name = placement.get("furniture_name", f"Item {i}")
            dims = placement.get("dimensions", {})
            
            story.append(Paragraph(f"<b>{i}. {name}</b>", styles['Normal']))
            story.append(Paragraph(f"Dimensions: {dims.get('width', 0):.0f}cm W × {dims.get('depth', 0):.0f}cm D × {dims.get('height', 0):.0f}cm H", item_style))
            story.append(Paragraph(f"Position: ({placement.get('x', 0):.2f}m, {placement.get('y', 0):.2f}m)", item_style))
            story.append(Paragraph(f"Rotation: {placement.get('rotation', 0):.0f}°", item_style))
            
            if options.get("includePricing", True):
                price = placement.get("price_cents", 0) / 100
                story.append(Paragraph(f"Price: ${price:.2f}", item_style))
    
    # Build PDF
    doc.build(story)
    
    logger.info(f"Generated PDF layout: {pdf_path}")
    return pdf_path

async def generate_floor_plan_image(room_data: Dict[str, Any], placements: List[Dict[str, Any]]) -> str:
    """Generate floor plan image using matplotlib"""
    await asyncio.sleep(0.3)
    
    # Create figure
    fig, ax = plt.subplots(1, 1, figsize=(10, 8))
    
    # Get room bounds
    floor_plan = room_data.get("floor_plan", {})
    bounds = floor_plan.get("bounds", {"min_x": 0, "max_x": 5, "min_y": 0, "max_y": 4})
    
    # Draw room outline
    room_width = bounds["max_x"] - bounds["min_x"]
    room_height = bounds["max_y"] - bounds["min_y"]
    
    room_rect = patches.Rectangle(
        (bounds["min_x"], bounds["min_y"]), 
        room_width, 
        room_height,
        linewidth=2, 
        edgecolor='black', 
        facecolor='lightgray',
        alpha=0.3
    )
    ax.add_patch(room_rect)
    
    # Draw walls
    walls = floor_plan.get("walls", [])
    for wall in walls:
        start = wall.get("start", {"x": 0, "y": 0})
        end = wall.get("end", {"x": 1, "y": 0})
        ax.plot([start["x"], end["x"]], [start["y"], end["y"]], 'k-', linewidth=3)
    
    # Draw doors
    doors = floor_plan.get("doors", [])
    for door in doors:
        pos = door.get("position", {"x": 0, "y": 0})
        width = door.get("width", 0.8)
        
        # Draw door opening
        door_arc = patches.Arc(
            (pos["x"], pos["y"]), 
            width * 2, 
            width * 2,
            angle=0, 
            theta1=0, 
            theta2=90,
            linewidth=1, 
            color='blue',
            linestyle='--'
        )
        ax.add_patch(door_arc)
    
    # Draw windows
    windows = floor_plan.get("windows", [])
    for window in windows:
        pos = window.get("position", {"x": 0, "y": 0})
        width = window.get("width", 1.2)
        
        # Draw window
        ax.plot([pos["x"] - width/2, pos["x"] + width/2], [pos["y"], pos["y"]], 'c-', linewidth=4)
    
    # Draw furniture
    colors_list = ['red', 'green', 'blue', 'orange', 'purple', 'brown', 'pink', 'gray']
    
    for i, placement in enumerate(placements):
        x = placement.get("x", 0)
        y = placement.get("y", 0)
        dims = placement.get("dimensions", {"width": 100, "depth": 50})
        rotation = placement.get("rotation", 0)
        
        width = dims.get("width", 100) / 100.0  # Convert cm to m
        depth = dims.get("depth", 50) / 100.0
        
        # Create furniture rectangle
        furniture_rect = patches.Rectangle(
            (x - width/2, y - depth/2),
            width,
            depth,
            angle=rotation,
            linewidth=1,
            edgecolor='black',
            facecolor=colors_list[i % len(colors_list)],
            alpha=0.7
        )
        ax.add_patch(furniture_rect)
        
        # Add label
        ax.text(x, y, str(i+1), ha='center', va='center', fontsize=8, fontweight='bold')
    
    # Set equal aspect ratio and limits
    ax.set_aspect('equal')
    ax.set_xlim(bounds["min_x"] - 0.5, bounds["max_x"] + 0.5)
    ax.set_ylim(bounds["min_y"] - 0.5, bounds["max_y"] + 0.5)
    
    # Add grid
    ax.grid(True, alpha=0.3)
    ax.set_xlabel('Distance (m)')
    ax.set_ylabel('Distance (m)')
    ax.set_title('Floor Plan Layout')
    
    # Save image
    image_path = f"/tmp/floor_plan_{room_data.get('id', 'unknown')}.png"
    plt.savefig(image_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    return image_path

async def generate_bom_export(layout_data: Dict[str, Any], options: Dict[str, Any]) -> str:
    """Generate Bill of Materials CSV export"""
    await asyncio.sleep(0.2)
    
    placements = layout_data.get("placements", [])
    csv_path = f"/tmp/bom_{layout_data.get('id', 'unknown')}.csv"
    
    # Prepare CSV data
    fieldnames = ["Item", "Quantity", "Unit Price", "Total Price", "Dimensions", "SKU", "Vendor"]
    
    if options.get("includeVendorLinks", True):
        fieldnames.append("Purchase Link")
    
    if options.get("includeAssemblyNotes", False):
        fieldnames.append("Assembly Notes")
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        total_cost = 0
        
        for placement in placements:
            name = placement.get("furniture_name", "Unknown Item")
            price_cents = placement.get("price_cents", 0)
            price = price_cents / 100
            dims = placement.get("dimensions", {})
            dim_str = f"{dims.get('width', 0):.0f}×{dims.get('depth', 0):.0f}×{dims.get('height', 0):.0f}cm"
            
            row = {
                "Item": name,
                "Quantity": 1,
                "Unit Price": f"${price:.2f}",
                "Total Price": f"${price:.2f}",
                "Dimensions": dim_str,
                "SKU": placement.get("furniture_id", "N/A"),
                "Vendor": "IKEA"  # Mock vendor
            }
            
            if options.get("includeVendorLinks", True):
                row["Purchase Link"] = f"https://ikea.com/product/{placement.get('furniture_id', '')}"
            
            if options.get("includeAssemblyNotes", False):
                row["Assembly Notes"] = "Assembly required - tools included"
            
            writer.writerow(row)
            total_cost += price
        
        # Add total row
        total_row = {
            "Item": "TOTAL",
            "Quantity": len(placements),
            "Unit Price": "",
            "Total Price": f"${total_cost:.2f}",
            "Dimensions": "",
            "SKU": "",
            "Vendor": ""
        }
        writer.writerow(total_row)
    
    logger.info(f"Generated BOM CSV: {csv_path}")
    return csv_path

async def generate_json_export(layout_data: Dict[str, Any], room_data: Dict[str, Any], options: Dict[str, Any]) -> str:
    """Generate JSON export with complete layout data"""
    await asyncio.sleep(0.1)
    
    json_path = f"/tmp/layout_{layout_data.get('id', 'unknown')}.json"
    
    # Prepare complete export data
    export_data = {
        "metadata": {
            "export_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "layout_id": layout_data.get("id"),
            "layout_name": layout_data.get("name"),
            "room_id": room_data.get("id"),
            "room_name": room_data.get("name")
        },
        "room": {
            "area_sqm": room_data.get("area_sqm", 0),
            "floor_plan": room_data.get("floor_plan", {}),
            "bounds": room_data.get("floor_plan", {}).get("bounds", {})
        },
        "layout": {
            "score": layout_data.get("score", 0),
            "strategy": layout_data.get("strategy", ""),
            "rationale": layout_data.get("rationale", ""),
            "violations": layout_data.get("violations", []),
            "metrics": layout_data.get("metrics", {})
        },
        "furniture": [],
        "summary": {
            "total_items": len(layout_data.get("placements", [])),
            "total_cost_cents": sum(p.get("price_cents", 0) for p in layout_data.get("placements", [])),
            "total_cost_usd": sum(p.get("price_cents", 0) for p in layout_data.get("placements", [])) / 100
        }
    }
    
    # Add furniture details
    for placement in layout_data.get("placements", []):
        furniture_item = {
            "id": placement.get("furniture_id", ""),
            "name": placement.get("furniture_name", ""),
            "position": {
                "x": placement.get("x", 0),
                "y": placement.get("y", 0),
                "rotation": placement.get("rotation", 0)
            },
            "dimensions": placement.get("dimensions", {}),
            "price_cents": placement.get("price_cents", 0),
            "price_usd": placement.get("price_cents", 0) / 100
        }
        
        if options.get("includeVendorLinks", True):
            furniture_item["purchase_url"] = f"https://ikea.com/product/{placement.get('furniture_id', '')}"
        
        export_data["furniture"].append(furniture_item)
    
    # Write JSON file
    with open(json_path, 'w', encoding='utf-8') as jsonfile:
        json.dump(export_data, jsonfile, indent=2, ensure_ascii=False)
    
    logger.info(f"Generated JSON export: {json_path}")
    return json_path

async def upload_export_to_storage(file_path: str, layout_id: str, file_type: str) -> str:
    """Upload export file to storage and return URL"""
    await asyncio.sleep(0.1)
    
    # Mock upload - in real implementation, use boto3 to upload to S3
    filename = f"{layout_id}.{file_type}"
    storage_url = f"https://storage.ai-interior-designer.com/exports/{filename}"
    
    logger.info(f"Uploaded {file_type} export to: {storage_url}")
    return storage_url

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

async def export_job_handler(msg):
    """Handle incoming export jobs from NATS"""
    try:
        job_data = json.loads(msg.data.decode())
        logger.info(f"Received export job: {job_data.get('id')}")
        
        result = await process_export_job(job_data)
        
        if nats_client:
            await nats_client.publish(
                "export.results",
                json.dumps(result.dict()).encode()
            )
            
    except Exception as e:
        logger.error(f"Error handling export job: {e}")

@app.on_event("startup")
async def startup_event():
    await connect_services()
    if nats_client:
        await nats_client.subscribe("export.jobs", cb=export_job_handler)
        logger.info("Subscribed to export.jobs")

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
        port=int(os.getenv("PORT", 8008)),
        reload=True
    )
