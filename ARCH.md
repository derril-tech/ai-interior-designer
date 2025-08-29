# AI Interior Designer -- Architecture (ARCH.md)

High-level topology, core services, data model, critical algorithms, and ops posture.

## 1) System Topology

```mermaid
flowchart LR
  subgraph Client
    A1[iOS (ARKit)] -->|scan frames| BFF
    A2[Web App] --> BFF
  end
  subgraph Edge
    BFF[Next.js 14 BFF] --> API[NestJS /v1 API]
  end
  subgraph Workers
    W1[scan-worker\nSLAM/photogrammetry] --> W4[layout-worker]
    W2[seg-worker\nsemantics/materials] --> W4
    W3[rag-worker\nvendor/product/citations] --> W4
    W4 --> W5[validate-worker\ncollision/clearances]
    W5 --> W6[render-worker\nPBR thumbs, USDZ/glTF]
    W3 --> W7[catalog-worker\nstock/price sync]
    W4 --> W8[export-worker\nPDF/BOM/JSON]
  end
  API <-->|NATS jobs| W1
  API <-->|NATS jobs| W2
  API <-->|NATS jobs| W3
  API <-->|NATS jobs| W4
  API <-->|NATS jobs| W5
  API <-->|NATS jobs| W6
  API <-->|NATS jobs| W7
  API <-->|NATS jobs| W8
  DB[(Postgres + pgvector)] <--> API
  S3[(S3/R2)] <--> W1
  S3 <--> W6
  S3 <--> W8
```

- Frontend/BFF: Next.js (App Router) on Vercel; Server Actions for signed uploads/exports; SSR boards and shared links.
- API Gateway: NestJS (Node 20), OpenAPI 3.1, Zod, RBAC (Casbin), RLS, Problem+JSON, Idempotency-Key, Request-ID (ULID).
- Workers: Python 3.11 FastAPI micro-services driven by NATS topics; Redis Streams for progress/SSE.
- Data: Postgres 16 + pgvector; S3/R2 for meshes & exports; Redis caches; optional ClickHouse for analytics.

## 2) Core Services

### scan-worker
- Inputs: scan frames + device pose (ARKit/ARCore/WebXR).
- Pipeline: visual-inertial SLAM -> photogrammetry -> watertight mesh (glTF) + metric floor plan.
- Outputs: walls/doors/windows, height, openings; quality score; USDZ/glTF assets.

### seg-worker
- Semantic segmentation (door/window/outlet/radiator), floor type/materials.
- OCR on signage/photo frames for privacy filter.
- Material/finish classifiers (wood/metal/fabric) + palette extraction.

### rag-worker
- Ingest vendor catalogs (GTIN, dims, assets, stock/price), care/assembly docs; external color/design guides.
- Build HNSW vector index (768-d) + BM25 hybrid; produce cited fact cards.

### layout-worker
- Constraint model (ILP/CP-SAT) with variables per placement (x, y, theta, flip).
- Objectives: maximize navigation flow, daylight use, symmetry/focal points, angle to TV, budget fit.
- Stochastic refinement (simulated annealing) over solver seed solutions.
- Generates K variants with rationales and rule audit trail.

### validate-worker
- 2D plan & 3D mesh intersection tests; door swing arcs; line-of-sight checks.
- Pathfinding heatmap (grid A* / fast marching) for flow score.
- Pet/child safety mode toggles stricter thresholds.

### render-worker
- Quick PBR thumbnails via Filament/Embree; baked light probes; texture compression; USDZ/glTF export.

### catalog-worker
- Vendor API sync; stock & lead-time updates; locale currency conversion; substitute search.

### export-worker
- Layout PDFs with dimensions, BOM CSV/JSON, AR packets; share links; immutable audit.

## 3) Data Model (DDL excerpt)

```sql
CREATE TABLE users(
  id UUID PRIMARY KEY, email CITEXT UNIQUE, name TEXT, tz TEXT, locale TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE projects(
  id UUID PRIMARY KEY, user_id UUID, title TEXT, address TEXT, currency TEXT,
  style_prefs TEXT[], budget_cents INT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rooms(
  id UUID PRIMARY KEY, project_id UUID, name TEXT, area_m2 NUMERIC, height_cm INT,
  floorplan JSONB, mesh_s3 TEXT, lighting JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products(
  id UUID PRIMARY KEY, vendor TEXT, sku TEXT, name TEXT, category TEXT,
  dims_cm JSONB, finishes TEXT[], price_cents INT, currency TEXT, url TEXT,
  asset_gltf TEXT, asset_usdz TEXT, stock JSONB, lead_time_days INT, policy JSONB,
  embedding VECTOR(768), updated_at TIMESTAMPTZ DEFAULT now()
);
```

Invariants: RLS on user/project; placements must satisfy bounds & min clearances; products require dimensions.

## 4) Public API Surface (REST /v1)
- POST /projects -> {title, budget_cents, style_prefs}
- POST /rooms -> {project_id, name}
- POST /rooms/:id/scan -> returns scan_id, signed upload URL; async mesh/floor plan.
- POST /layouts/generate -> {room_id, intents[], budget_cents?, constraints?}
- GET /layouts/:id -> placements, rationale, violations.
- POST /moodboards/generate -> {project_id, style_tags?, reference_images?}
- GET /rooms/:id/ar/usdz and GET /layouts/:id/gltf
- POST /exports/layout-pdf and /exports/bom
- GET /search?q=...&room_id=... -> RAG-cited fact cards.

All long-running endpoints stream progress via SSE (/tasks/:id/stream).

## 5) Algorithms (Key Details)

### 5.1 Constraint Model
- Decision vars: x_i, y_i in R, theta_i (discrete or continuous); binary z_i for selection.
- Hard constraints:
  - Room bounds; clearances around furniture (walkway >= 80 cm, window access >= 60 cm).
  - Door swing arcs not intersected.
  - TV viewing: distance within [1.5x, 3x] diagonal; angle <= 30 deg off-axis.
  - Desk/seat ergonomics (seat height, knee clearance).
- Soft constraints (objective terms):
  - Flow score (A* path cost), daylight exposure (distance/angle to windows), symmetry, focal composition, budget distance.
- Solve with OR-Tools CP-SAT. Seed with heuristic placements (wall-aligned, golden-ratio anchors), then refine via simulated annealing.

### 5.2 Validation
- Mesh voxelization (5--10 cm grid) for collision; swept volumes for rotations.
- Clearance bands rendered as heat overlays; report violations with fix hints.

### 5.3 Moodboard
- Palette from K-means on LAB space; material harmony rules (warm/cool wood; metal mixing).
- Similarity search via CLIP/ViT embeddings; diversify by finish/texture.

## 6) AR & Visualization
- iOS: ARKit (USDZ Quick Look) with true-scale anchors; environment texturing for lighting.
- Web: react-three-fiber; WebXR hit-test; occlusion via depth API where available; fallback to ruler calibration.
- Scale checks: virtual 1 m cube placement; user confirms alignment -> adjust scale drift epsilon.

## 7) Security, Privacy, Compliance
- Signed S3 URLs; per-project envelope encryption.
- On-device face/photo-frame blur (default on).
- "Private mode" stores only derived geometry (no raw imagery).
- GDPR export/delete; immutable audit of exports/purchases.

## 8) Observability & Ops
- OpenTelemetry traces per job stage; Prometheus metrics.
- Sentry for client & workers; structured logs with Request-ID/Trace-ID.
- Autoscale GPU pools for scan/render; DLQ with backoff/jitter.
- SLOs: Scan->plan < 45 s p95; 3 layout variants < 8 s p95; AR export < 5 s p95.

## 9) Testing Strategy
- Golden rooms (CAD) with expected placements & violations.
- Unit tests: plane/edge detection, door/window classifiers, clearance math, palette extraction.
- Integration: scan -> mesh -> layout -> validate -> AR export -> BOM.
- Physics: pose round-trip across glTF/USDZ; collision invariants.
- E2E (WebXR emu + Playwright): mobile scan -> layout -> AR preview -> export PDF.

## 10) Deployment
- FE: Vercel. APIs & workers: GKE/Fly/Render, autoscale by queue depth.
- DB: Managed Postgres + pgvector; read replicas; PITR.
- Storage/CDN: S3/R2 with image/mesh transforms; CDN caching.
- CI/CD: GitHub Actions (lint/typecheck/unit/integration, image scan, sign, deploy); blue/green; migration approvals.
