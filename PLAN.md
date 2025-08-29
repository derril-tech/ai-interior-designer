# AI Interior Designer -- Product Plan (PLAN.md)

## One-liner
"Scan any room and get instant, shoppable layouts and moodboards -- accurate to the centimeter, overlaid in AR with citations to real products."

## Vision
Put a spatially-aware, evidence-backed interior designer into every phone. Users scan a room once and receive pragmatic layouts, moodboards, and a shoppable bill of materials (BOM), all validated against real-world constraints (clearances, door swings, daylight) and linked to in-stock products for their locale.

## Target Users
- Homeowners & renters planning refreshes or moves.
- Interior designers creating first-pass concepts fast.
- Furniture retailers/marketplaces enabling "see it in your room."
- Property developers/stagers producing quick set-dressing plans.

## Goals (MVP -> V1)
- MVP (Private Alpha)
  - Room scan -> metric floor plan + 3D mesh (glTF/USDZ).
  - 3 layout variants per room with measurable placements & min-clearance guarantees.
  - Moodboard generation (palette, hero pieces) with cited products from 1--2 vendors.
  - AR true-scale overlay for one chosen layout.
  - Export: layout PDF w/ dimensions, BOM CSV/JSON bundle.
- V1 (Public Beta)
  - Semantic detection: doors/windows/outlets/radiators + floor type.
  - Constraint solver with multi-objective optimization (navigation flow, daylight, focal points, budget).
  - Shopping: in-stock filters by locale, alternatives, cart deep links, lead-time awareness.
  - Collaboration: versioned layouts, comments, share links.
  - Privacy controls: on-device face/photo-frame blur, "privacy mode."

## Non-Goals (for now)
- Structural changes (moving walls), electrical rewires, permit advice.
- Photoreal path-tracing renders. (We deliver fast PBR thumbs + AR.)
- Full professional CD sets (construction drawings).

## Key User Stories
- As a renter, I scan my living room and receive 2--4 layouts (e.g., "Cozy Conversation", "WFH + Lounge"), with walkways >= 80 cm and TV viewing distance respected.
- As a shopper, I tap Shop Alternatives to see in-stock equivalents that fit the same footprint and budget.
- As a designer, I export a BOM CSV and a USDZ to present in AR in front of the client.
- As a team, we comment on placements and version variants, then export a final PDF with dimensions and citations.

## KPIs & Success Criteria
- Time to first layout < 3 min from scan completion (p95).
- Acceptance rate (Save or AR preview on first session) >= 65%.
- BOM add-to-cart rate >= 25%; purchase CTR >= 12%.
- Designer productivity: concept cycle time -50% vs baseline.
- Accuracy: AR scale error < 1.5% over 4 m span; clearance false-negatives < 1% on golden rooms.

## Competitive Edge
- Constraint-aware layout solver with explicit code-like rules (documented and testable).
- RAG-cited product intelligence (dimensions, care, assembly, clearances).
- On-device privacy options (face/frame blur; private mode).

## End-to-End Flow
1) Scan room (ARKit/ARCore/WebXR) -> floor plan + 3D mesh; semantic features.
2) Embed room & ingest vendor products (dimensions, glTF/USDZ, stock).
3) Generate 2--4 layout variants -> validate (collisions, arcs, LOS) -> score.
4) Moodboard: palette from room + hero piece; textiles/lighting/art suggestions.
5) Preview in AR -> snap to anchors; occlusion; lighting estimate.
6) Shop & Export: BOM/cart links; PDF with dimensions; JSON bundle.

## MVP Scope (cut-line)
- Platforms: iOS (ARKit) + Web viewer; Android as stretch (ARCore generic depth).
- Vendors: start with IKEA + Wayfair sample feeds; add 1 premium brand post-MVP.
- Constraints: walkway >= 80 cm, door swings, window access >= 60 cm, TV viewing distance (min 1.5x screen diag), desk ergonomics (seat height 43--48 cm).

## Risks & Mitigations
- Scan quality variance -> Quality meter + guided hints; offline retry/resume; golden rooms for QA.
- Vendor data gaps -> RAG + manual curation; filter out items without dims.
- AR scale drift -> anchor calibration step; ruler cross-check; scale sanity tests vs floor plan.
- Constraint false-negatives -> unit tests on clearance math; simulation heatmaps; human override with audit note.
- Privacy concerns -> on-device face/frame blur; private mode (no upload); signed URLs; GDPR delete/export.

## Legal & Safety
- Prominent disclaimer: "Design assistant -- not a licensed architect."
- Structural/electrical work flagged for professional review.
- In-stock and locale filters by default; "concept only" toggle exposes out-of-stock/international items.

## Rollout Plan
- Alpha (4--6 weeks): internal/golden rooms -> layout solver v1, AR preview, IKEA catalog subset.
- Private Beta (6--10 weeks): add Wayfair, moodboards, comments, exports, iOS TestFlight.
- Public Beta: Android/WebXR, more vendors, alternatives, shopping carts, performance polish.

## Pricing (tentative)
- Free try (1 room, 1 layout export).
- Pro: $9/mo (unlimited rooms, exports, AR packets).
- Designer: $29/mo (collaboration, brand boards, priority support).
- Retailer SDK: usage-based.
