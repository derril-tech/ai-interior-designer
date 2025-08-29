AI Interior Designer — AR + RAG: scan a room, AI suggests furniture layouts, moodboards 

 

1) Product Description & Presentation 

One-liner 

“Scan any room and get instant, shoppable layouts and moodboards—accurate to the centimeter, overlaid in AR with citations to real products.” 

What it produces 

Room model: metric floor plan, wall heights, doors/windows, fixed features; 3D mesh (glTF/USDZ). 

Furniture layouts: multiple concepts (e.g., “Cozy Conversation”, “Work+Lounge”), with measured placements, clearances, cable/power hints. 

Moodboards: palettes, textures, materials, hero pieces; citation cards linking to vendors. 

AR view: true-scale overlays, occlusion, lighting estimation, surface snapping. 

Exports: layout PDFs with dimensions, BOM (bill of materials), shopping list, and JSON bundle (room, placements, products). 

Scope/Safety 

Design assistant, not a licensed architect; structural/electrical work requires professional review. 

On-device face/photo-frame blurring; privacy mode (no image upload). 

Only shows in-stock items for the user’s locale unless “concept only” is selected. 

 

2) Target User 

Homeowners & renters planning makeovers or moves. 

Interior designers creating first-pass concepts fast. 

Furniture retailers/marketplaces enabling AR “see it in your room.” 

Property developers & staging teams producing quick set-dressing plans. 

 

3) Features & Functionalities (Extensive) 

Scan & Understand (Mobile/WebXR) 

Room scanning: ARKit/ARCore/WebXR; plane & edge detection, photogrammetry/NeRF-lite; IMU fusion. 

Semantic mapping: detect doors, windows, outlets, radiators, built-ins; floor type & major materials. 

Measure & annotate: ceiling height, spans, niches; manual adjust & lock constraints; unit systems (cm/in/ft). 

RAG & Product Intelligence 

Catalog ingestion: vendor feeds (GTIN/GLB/OBJ/USdz), dimensions, finishes, lead times, stock, price, return policy. 

RAG search over vendor docs (care, assembly, clearance rules), design blogs, color guides → fact cards & tips. 

Style embeddings: CLIP/ViT vectors for items & reference images; user taste profile. 

Layout Generation & Validation 

Constraint solver: keeps code-compliant clearances (e.g., walkway ≥ 80 cm), door swing arcs, window access, TV viewing distances, desk ergonomics. 

Optimization: multi-objective (flow/navigation, daylight use, symmetry, focal points, TV angles, budget). 

Collision/clearance: 2D floor plan & 3D mesh intersection; traffic heatmap; pet/child safety mode. 

Variants: minimal budget, premium, rental-friendly, WFH mode, guest mode. 

Moodboard & Styling 

Palette extraction from room photos (dominant/accents), material harmony (wood tones, metals). 

Board composer: hero piece → complementary textures; suggest textiles, art, lighting; replace rules (swap sofa ↔ sectional). 

Render previews: quick PBR thumbnails with estimated lighting & shadows. 

AR & Visualization 

Live AR preview of selected layout; occlusion with detected geometry; true-scale snapping. 

Lighting sim: rough sun path by location/time; dimmer scenes (“evening cozy”). 

Before/After slider; record/share walkthrough. 

Shopping & Logistics 

BOM & cart: quantities, SKUs, surfaces (m²/ft² for wallpaper/flooring), price totals, bundles. 

Availability: local stock, delivery ETA, assembly add-ons. 

Alternatives: cheaper/sustainable/quick-ship substitutes with fit confirmed to room. 

Collaboration & Governance 

Multi-user boards; comments per placement; versioned layouts. 

Project templates (studio, 1-bed, home office). 

Audit trail for all exports & purchase link clicks. 

 

4) Backend Architecture (Extremely Detailed & Deployment-Ready) 

4.1 Topology 

Frontend/BFF: Next.js 14 (Vercel), Server Actions (uploads/exports), SSR for boards, ISR for shared links. 

API Gateway: NestJS (Node 20) — REST /v1, OpenAPI 3.1, Zod validation, Problem+JSON, RBAC (Casbin), RLS (by user/project), Idempotency-Key, Request-ID (ULID). 

Workers (Python 3.11 + FastAPI controller) 

scan-worker: SLAM/photogrammetry → floor plan + mesh; door/window/outlet detection. 

seg-worker: semantic segmentation, material/finish classifiers. 

style-worker: embeddings for room & items; user taste vector. 

rag-worker: vendor/doc ingestion, retrieval & citation packs. 

layout-worker: constraint modeling + solver (ILP/CP-SAT) + stochastic refinement. 

validate-worker: collision/clearance checks, pathfinding/heatmap. 

render-worker: fast PBR thumbs (Embree/Filament); USDZ/glTF export. 

catalog-worker: vendor sync (stock/price), feed normalization. 

export-worker: PDF/BOM/JSON/AR packets. 

Event bus: NATS topics (scan.ingest, mesh.build, sem.segment, style.embed, rag.index, layout.make, layout.validate, render.thumb, catalog.sync, export.make) + Redis Streams (progress/SSE). 

Data 

Postgres 16 + pgvector (projects, rooms, meshes, placements, moodboards, products, embeddings). 

S3/R2 (raw scans, meshes, textures, exports). 

Redis (session, cache, short-lived AR anchors). 

Observability: OpenTelemetry (traces), Prometheus/Grafana, Sentry. 

Secrets: Cloud KMS; vendor API keys; per-project encryption envelope. 

4.2 Data Model (Postgres + pgvector) 

CREATE TABLE users ( 
  id UUID PRIMARY KEY, email CITEXT UNIQUE, name TEXT, tz TEXT, locale TEXT, created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE projects ( 
  id UUID PRIMARY KEY, user_id UUID, title TEXT, address TEXT, currency TEXT, 
  style_prefs TEXT[], budget_cents INT, created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE rooms ( 
  id UUID PRIMARY KEY, project_id UUID, name TEXT, area_m2 NUMERIC, height_cm INT, 
  floorplan JSONB, -- walls, doors, windows, openings with geo 
  mesh_s3 TEXT, lighting JSONB, created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE scans ( 
  id UUID PRIMARY KEY, room_id UUID, s3_key TEXT, frames INT, quality TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE products ( 
  id UUID PRIMARY KEY, vendor TEXT, sku TEXT, name TEXT, category TEXT, subcategory TEXT, 
  dims_cm JSONB, -- {w,d,h,seat_h,...} 
  finishes TEXT[], price_cents INT, currency TEXT, url TEXT, asset_gltf TEXT, asset_usdz TEXT, 
  stock JSONB, lead_time_days INT, policy JSONB, embedding VECTOR(768), updated_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE layouts ( 
  id UUID PRIMARY KEY, room_id UUID, title TEXT, strategy TEXT, score NUMERIC, rationale TEXT, 
  created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE placements ( 
  id UUID PRIMARY KEY, layout_id UUID, product_id UUID, pose JSONB, -- translation/rotation/scale 
  clearance_cm JSONB, anchor TEXT, notes TEXT 
); 
 
CREATE TABLE moodboards ( 
  id UUID PRIMARY KEY, project_id UUID, title TEXT, palette TEXT[], textures TEXT[], hero_product UUID, rationale TEXT 
); 
 
CREATE TABLE citations ( 
  id UUID PRIMARY KEY, layout_id UUID, source TEXT, excerpt TEXT, url TEXT, page INT 
); 
 
CREATE TABLE exports ( 
  id UUID PRIMARY KEY, project_id UUID, kind TEXT, s3_key TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now() 
); 
 
CREATE TABLE audit_log ( 
  id BIGSERIAL PRIMARY KEY, user_id UUID, action TEXT, target TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now() 
); 
  

Invariants 

RLS on user_id / project_id. 

Every placement must satisfy room bounds & min clearances; validated before export. 

Products require dimensions for layout eligibility. 

Citations attach to a layout/moodboard when RAG facts are surfaced. 

4.3 API Surface (REST /v1) 

Projects & Rooms 

POST /projects {title, budget_cents, style_prefs} 

POST /rooms {project_id, name} 

POST /rooms/:id/scan {upload_url} → returns scan_id → async mesh/floorplan 

Design & Layouts 

POST /layouts/generate {room_id, intents:["cozy","WFH"], budget_cents?, constraints?} 

GET /layouts/:id → placements, rationale, violations (if any) 

POST /layouts/:id/alternates {swap_rules} 

Moodboards & RAG 

POST /moodboards/generate {project_id, reference_images?, style_tags?} 

GET /search?q="sofa clearance"&room_id=... (cited cards) 

AR & Assets 

GET /rooms/:id/ar/usdz (true-scale USDZ) 

GET /layouts/:id/gltf (layout as glTF, compressed textures) 

Catalog & Shopping 

GET /products/similar?product_id=...&price_max=... 

POST /carts/create {layout_id, vendor:"ikea"} (deep link or affiliate bundle) 

Exports 

POST /exports/layout-pdf {layout_id} 

POST /exports/bom {layout_id, format:"csv|json"} 

Conventions: Idempotency-Key; pagination; SSE streams for scan→mesh & layout→validate progress. 

4.4 Pipelines 

Scan → Mesh: frames → SLAM/photogrammetry → floor plan & 3D mesh → semantic features. 

Embed & Index: room/material embeddings; vendor catalog upsert + embeddings. 

Generate Layouts: rule seed → ILP/CP-SAT → refine with simulated annealing; compute scores. 

Validate: collisions, clearances, door swings, line-of-sight; produce traffic heatmap. 

Render/AR: bake light probes; export USDZ/glTF; thumbs for moodboard. 

Export: PDF with dimensions, BOM, citations; JSON bundle. 

4.5 Security & Compliance 

SSO (Apple/Google); encrypted media; signed URLs. 

On-device redaction (faces/personal photos) before upload when enabled. 

Data export/delete endpoints (GDPR); immutable audit of purchases/exports. 

 

5) Frontend Architecture (React 18 + Next.js 14 — Looks Matter) 

5.1 Design Language 

shadcn/ui + Tailwind; glass panels, soft neon accents, motion blur on transitions; dark mode first. 

Framer Motion: scan progress waves, board tile springs, AR anchor pulse. 

3D: react-three-fiber + drei; post-processing glow/shadows; crisp PBR thumbnails. 

5.2 App Structure 

/app 
  /(marketing)/page.tsx 
  /(auth)/sign-in/page.tsx 
  /(app)/projects/page.tsx 
  /(app)/rooms/[id]/scan/page.tsx 
  /(app)/rooms/[id]/design/page.tsx 
  /(app)/moodboards/page.tsx 
  /(app)/ar/[layoutId]/page.tsx 
  /(app)/shop/page.tsx 
  /(app)/exports/page.tsx 
/components 
  ScanWizard/*            // AR/WebXR capture, quality meter 
  FloorPlanEditor/*       // wall lines, openings, measure tool 
  LayoutGallery/*         // variant cards with score badges 
  ClearanceOverlay/*      // red/green heat for paths & arcs 
  PlacementInspector/*    // pose gizmo, snap, nudge, rotate 
  MoodboardCanvas/*       // drag textures/tiles; palette chips 
  ProductCard/*           // vendor, price, finish, in-stock tag 
  ARViewer/*              // USDZ/Quick Look link or WebXR session 
  BOMPanel/*              // quantities, cost breakdown 
  ExportWizard/*          // PDF/BOM/JSON themes 
/store 
  useProjectStore.ts 
  useRoomStore.ts 
  useLayoutStore.ts 
  useBoardStore.ts 
  useShopStore.ts 
/lib 
  api-client.ts 
  sse-client.ts 
  zod-schemas.ts 
  rbac.ts 
  

5.3 Key UX Flows 

Scan Wizard → live edge hints, occlusion preview, quality bar → finish → auto floor plan. 

Design Board → pick intents/constraints → animated LayoutGallery populates → inspect in 3D, toggle ClearanceOverlay. 

Placement Tuning → drag/nudge; snap to walls; rotate with angle guide; instant validation pips. 

Moodboard → drop hero piece; palette suggests textiles/art/lighting; swap finishes with cross-fades. 

AR Preview → tap to place anchors; true-scale snap; record/share. 

Shop & Export → BOM panel → vendor carts or links → export PDF/BOM/JSON. 

5.4 Validation & Errors 

Inline Problem+JSON toasts; guards: cannot export or open AR if any violation persists. 

Manual override requires reason → audit log. 

Offline cache for scans; retry/resume uploads. 

5.5 A11y & i18n 

Keyboard controls for gizmos; high-contrast overlays; alt text for thumbnails. 

Locale units/currencies; RTL support. 

 

6) SDKs & Integration Contracts 

Start scan & upload frames 

POST /v1/rooms/{id}/scan 
{ "frames": 240, "device":"iPhone15,3" } -> { "scan_id":"UUID","upload_url":"..." } 
  

Generate layouts 

POST /v1/layouts/generate 
{ "room_id":"UUID","intents":["cozy","conversation"],"budget_cents":350000,"constraints":{"tv_viewing_distance_cm":240} } 
  

Fetch AR assets 

GET /v1/rooms/{id}/ar/usdz 
GET /v1/layouts/{id}/gltf 
  

Get moodboard 

POST /v1/moodboards/generate 
{ "project_id":"UUID","style_tags":["mid-century","warm neutrals"] } 
  

Create cart / BOM 

POST /v1/carts/create { "layout_id":"UUID","vendor":"wayfair" } 
POST /v1/exports/bom   { "layout_id":"UUID","format":"csv" } 
  

JSON bundle keys: rooms[], scans[], products[], layouts[], placements[], moodboards[], citations[], exports[]. 

 

7) DevOps & Deployment 

FE: Vercel (Next.js). 

APIs/Workers: GKE/Fly/Render; dedicated GPU nodes for scan-worker/render-worker; autoscale by queue depth; DLQ/backoff. 

DB: Managed Postgres + pgvector; PITR; read replicas. 

Storage/CDN: S3/R2; image/mesh CDN transforms. 

CI/CD: GitHub Actions (lint/typecheck/unit/integration, image scan, sign, deploy); blue/green; migration approvals. 

SLOs 

Scan→floor plan (avg room) < 45 s p95. 

Layout generation (3 variants) < 8 s p95. 

AR asset export < 5 s p95. 

Catalog refresh latency < 10 min. 

 

8) Testing 

Unit: plane/edge detection; door/window classifier; clearance math; palette extraction; price/stock adapters. 

Integration: scan → mesh → layout → validate → AR export → BOM. 

Physics: collision & clearance invariants; pose round-trip (glTF/USDZ). 

Golden rooms: fixed CAD rooms with expected placements/violations. 

E2E (Playwright + WebXR emu): mobile scan → pick layout → AR preview → export PDF. 

Load/Chaos: burst scans, large meshes, vendor API timeouts; retries & cache. 

Security: RLS coverage; signed URL scope; PII redaction enforcement. 

 

9) Success Criteria 

Product KPIs 

Time to first layout < 3 min from initial scan. 

User acceptance (“Save or AR preview”) ≥ 65% on first session. 

Cart add-to-BOM rate ≥ 25%; purchase click-through ≥ 12%. 

Designer teams: concept cycle time −50% vs baseline. 

Engineering SLOs 

Pipeline success ≥ 99% (excl. bad scans). 

Clearance violation false-positive < 3%; false-negative < 1% (golden rooms). 

AR scale error < 1.5% over 4 m span. 

 

10) Visual/Logical Flows 

A) Scan → Model 

 User scans → edges/planes → mesh & floor plan → semantic features → manual nudge if needed. 

B) Model → Layouts 

 Select intents/budget → solver generates 2–4 variants → validate (clearances, arcs, LOS) → score & explain. 

C) Layouts → Moodboard 

 Pick a variant → palette/texture suggestions → compose board → swap finishes, see renders. 

D) Preview & Shop 

 AR overlay → walk through; approve → BOM + carts (vendor links) + alternatives. 

E) Export & Share 

 Download PDF (dimensions, diagrams), BOM CSV, and AR packets; share link with comments & revisions. 

 

 