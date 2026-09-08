---
kind: phase
name: phase-07-home-search
sources_mtime:
  docs/project-plan.md: "2026-08-31 22:18:23.872559222 -0300"
  docs/decisions/technical-decisions-home-search.md: "2026-09-08 07:59:34.547264086 -0300"
  docs/phases/phase-05-watch-page/context.md: "2026-09-02 21:55:39.044449606 -0300"
  docs/phases/phase-06-social/context.md: "2026-09-02 22:42:24.343285127 -0300"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-08-31 22:18:23.772557281 -0300"
  .claude/skills/testing-guide-next-frontend/SKILL.md: "2026-08-31 22:18:23.773628364 -0300"
---

# phase-07-home-search — Context

## Scope

**Phase name:** Página Inicial, Busca e Finalização

**Capabilities** (literal, `docs/project-plan.md`):

- Página inicial com grid de vídeos (thumbnail, título, canal, visualizações e tempo de publicação)
- Filtro de vídeos por categoria na home
- Barra de busca (pesquisa por título e canal)
- Header/navbar com logo, barra de busca, botão de login/avatar e navegação
- Paginação ou scroll infinito nas listagens de vídeos
- Layout responsivo para dispositivos móveis
- Testes dos fluxos principais da plataforma
- Ambiente de produção e deploy

**Out of scope:** _Not specified._

**Deliverables:** home page, busca, navegação, responsividade, testes realizados e ambiente de produção configurado.

**Affected subprojects:**

- `nestjs-project/` — search endpoint, home video listing endpoint, production Docker config
- `next-frontend/` — home page, navbar, search page, responsive layout, production build

**Deferred subprojects:** _None._

**Sequencing notes:** Depende de: todas as fases anteriores.

**Neighbors (for boundary detection only):**

- **Phase 06:** Interações Sociais — Likes, comments, subscriptions.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| home-search/TD-01 | phase | Backend | Search Implementation | decided | A (ILIKE + pg_trgm index) | — |
| home-search/TD-02 | phase | Backend | Home Page Data Source | decided | A (Dedicated endpoint) | — |
| home-search/TD-03 | phase | Frontend | Navbar Architecture | decided | A (Shared RSC layout) | — |
| home-search/TD-04 | phase | Repo-wide | Production Deployment | decided | A (Docker Compose production profile) | — |

## Capability Coverage

| Capability | Covered by |
|------------|------------|
| Página inicial com grid de vídeos | home-search/TD-02 |
| Filtro de vídeos por categoria na home | home-search/TD-02 |
| Barra de busca (pesquisa por título e canal) | home-search/TD-01 |
| Header/navbar com logo, busca, login/avatar | home-search/TD-03 |
| Paginação ou scroll infinito | home-search/TD-02 |
| Layout responsivo | home-search/TD-03 |
| Testes dos fluxos principais | home-search/TD-01, TD-02, TD-03 |
| Ambiente de produção e deploy | home-search/TD-04 |