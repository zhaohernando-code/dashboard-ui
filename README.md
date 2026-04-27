# Dashboard UI

React + TypeScript control-plane frontend for the local Codex control plane.

## Canonical docs

- `PROJECT_STATUS.json`: current phase, blockers, next step, and linked docs
- `README.md`: operator-facing overview and delivery model
- `PROJECT_RULES.md`: repo-local UI and rollout constraints
- `DECISIONS.md`: durable product and workflow decisions
- `PROCESS.md`: reusable lessons and anti-regression notes
- `REQUIREMENTS_COVERAGE.md`: acceptance mapping when needed
- `docs/contracts/`: active contracts and operator-facing specs
- `docs/archive/`: historical notes when they exist

## Runtime Topology

- The operator-facing entrypoint is the authenticated control-plane route `https://hernando-zhao.cn/middle`.
- The public domain root `https://hernando-zhao.cn/` is reserved for the unified login and app-entry page, not the dashboard itself.
- The dashboard talks to the control-server API on `http://127.0.0.1:8787` behind the server entrypoint.
- Dynamic business projects may appear under `/projects/<project-id>/`; static release bundles stay under `/tools/<project-id>`.
- Treat `8787` as an internal API/dev address only.

## Local development

```bash
npm install
npm run dev
```

For local development only, the app defaults to `http://localhost:8787` as its API base.

## Delivery behavior

- Production builds are served by the control plane, not by the Vite preview server.
- The dashboard talks to the live control-plane API directly; GitHub issue queue and GitHub Pages browser transport are historical paths only.
- Repository automation remains a server-side capability when valid GitHub credentials are configured.
- When a project is created with local tunnel exposure enabled, the dashboard sends the desired local ports and lets the local worker generate the tunnel env and LaunchAgent automatically.
- This repo now ships a `.codex.deploy.json` profile so successful local-worker tasks can build the UI on the Mac and sync the release bundle to the server automatically.

## Task closeout

- Default branch name: `task/dashboard-ui/<yyyymmdd>-<slug>`
- Before calling work complete, update `DECISIONS.md`, `PROCESS.md`, and `PROJECT_STATUS.json` when the change affects durable decisions, reusable lessons, or current handoff state.
- Production verification must happen on the served control-plane route, not only in the local Vite dev server.
