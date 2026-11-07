# AI Knowledge Index

> This file is the entry point for AI assistants, located at `prospec/index.md`.
> Read this first, then load specific module READMEs or load-on-demand conventions as needed.

<!-- prospec:auto-start -->
## Conventions

**Core Conventions (L1)**
These files are NOT auto-loaded. The AI MUST actively read them at the start of a task if not already in context:
- `prospec/ai-knowledge/_conventions.md`
- `prospec/ai-knowledge/_diagram-conventions.md`
- `prospec/ai-knowledge/_glossary.md`

**Load-on-Demand Conventions**
Load these specific convention files only when their topics are relevant to the task:
- `prospec/ai-knowledge/_status-lifecycle.md`
- `prospec/ai-knowledge/_module-readme-conventions.md`
- `prospec/ai-knowledge/_playbook.md`
- `prospec/ai-knowledge/_lessons-ledger.md`

## Modules

_Populated by `prospec-knowledge-generate`. Run `prospec knowledge init` first to produce raw-scan.md, then use the AI Skill to analyze and fill this section._

_Table format: Module | Keywords | Aliases | Status | Description | Rationale | Depends On_

_Optional grouping: when modules have categories and fall into ≥2 primary domain categories, they are automatically grouped under `### {Category}` sub-headings (each sub-table reuses the columns above; a module appears under its primary category only). Projects without categories keep one flat table._
<!-- prospec:auto-end -->

## Project Info

- **Project**: taipei-codefest-2026
- **Tech Stack**: javascript
- **Knowledge Base**: `prospec/ai-knowledge`

<!-- prospec:user-start -->
<!-- Add custom project notes here. This section is preserved on regeneration. -->
<!-- prospec:user-end -->

## Progressive Knowledge Loading Strategy

| Layer | Files | When to Load | Token Budget |
|-------|-------|-------------|-------------|
| **L0** | `AGENTS.md` / `CLAUDE.md` | Every conversation (auto-injected via agent config) | Agent-injected — out of `knowledge-size` scope |
| **L1** | `prospec/index.md` + Core Conventions + Context-specific artifacts | At startup (acts as entry point and current task context) | ≤ 1800 tokens per file |
| **L2** | `prospec/ai-knowledge/modules/{name}/README.md` (plus linked sub-module and supplementary docs) | When Skill identifies related modules from L1 keywords | ≤ 1000 tokens per module file — module Markdown files, including linked documents; also ≤ 100 lines |
| **Spec** | `prospec/specs/features/**/*.md` + `prospec/specs/product.md` | When Skill identifies related features | ≤ 5000 tokens per spec file — a slice under `features/{feature}/` is measured alike |
| **Demand** | Demand Conventions (lessons ledger, playbook, …) | When their topic is relevant — read in slices, never whole | ≤ 10000 tokens per file |
| **L3** | Source code files | When Agent needs implementation details | No limit (read on demand) |

> Every budget below L0 comes from `.prospec.yaml` `knowledge.token_budget` (this project's values; defaults when unset). Over-budget files WARN via `prospec check` `knowledge-size` (from 0.85 of the limit, a pressure signal), never a build breaker; each finding names its convergence path. L0 is agent-injected config, out of scope.

**Principles:**
1. L0 answers "how to use skills" — L1 answers "where to look" and "what to do" — L2 answers "what it does" (Feature Spec) and "how to modify" (Module README) — L3 answers "how to write"
2. Each layer must NOT duplicate information available in a lower layer
3. Use README.md as the module knowledge entry point, linking sub-module and supplementary docs.
4. Sub-modules are an L2 sub-layer reached via the README's `## Sub-Modules` links — never listed in `prospec/index.md`
