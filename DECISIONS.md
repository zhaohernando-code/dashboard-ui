# Dashboard UI Decisions

[2026-04-27T17:30:00+08:00] Canonical dashboard handoff decision:
This repo now uses `PROJECT_STATUS.json` as the first current-state handoff source, `DECISIONS.md` as the durable product and rollout decision log, and `PROCESS.md` as the reusable lessons log. New sessions should route here through `~/codex/WORKSPACE_INDEX.json` instead of inferring the target from broad workspace search.

补充说明
- The operator-facing surface remains the public control-plane route `https://hernando-zhao.cn/middle`.
- Local Vite behavior is useful for development, but it does not replace served-route verification for live-facing changes.
