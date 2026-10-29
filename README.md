# UML Studio AI

AI-assisted UML modeling: from natural-language requirements to coherent, editable, validated UML models.
Grounded in Booch's object-oriented design principles and OMG UML 2.x semantics.

This is the Phase 1 + basic AI MVP.

## Features

- **Diagrams:** class, use case, sequence and activity.
- **Model/view separation:** a typed UML model (`src/lib/uml/types.ts`) is the source of truth. The canvas only renders it, and moving shapes changes layout, not semantics.
- **Editor:** React Flow canvas with UML notation (generalization, realization, aggregation, composition, dependency, include/extend, guards, multiplicities, roles). There is also a dedicated SVG sequence-diagram renderer with activation bars. Includes a palette, properties panel, auto-layout (TB/LR), undo/redo (Ctrl+Z / Ctrl+Shift+Z) and a simplified/detailed class view.
- **Validation:** live errors, warnings and suggestions. Covers endpoint compatibility, multiplicity syntax, inheritance cycles, unresolved types, encapsulation, use case coverage, sequence reply matching, activity initial/final/fork/join/decision rules and reachability. Click an issue to select the element.
- **AI:** generate a diagram from a prompt plus project requirements, or refine the current one. Uses structured output that is validated with Zod. Refinement keeps element identity and positions, and a report shows added, removed, modified and dropped content. Assumptions are tagged explicit, inferred, question or recommendation, and you can accept or reject each one. A failed generation never replaces your diagram.
- **Persistence:** projects autosave in browser localStorage. JSON project import/export.
- **Export:** PNG, SVG, PlantUML (`.puml`, with any notation losses reported), and diagram model JSON.

## Running locally

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # add an API key to enable AI
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Enables AI generation (server-side only) |
| `AI_PROVIDER` | Optional: `openai` or `anthropic` when both keys are set |
| `AI_MODEL` | Optional model override |

Without a key, everything except AI generation works, and each project can start from example diagrams.

## Scripts

`npm run dev` · `npm run build` · `npm test` (Vitest model/validation tests) · `npm run lint` · `npm run typecheck`

## Not yet implemented

The remaining 10 UML diagram types, accounts/database storage, collaboration, versioning and XMI import/export are later phases of the SRS.
