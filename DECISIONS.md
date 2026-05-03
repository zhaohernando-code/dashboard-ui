# Dashboard UI Decisions

[2026-05-04T00:10:00+08:00] Workflow gate visibility decision:
Dashboard task detail now treats `workflowGates` as backend-owned closeout state and displays it beside the acceptance flow. Operators should see missing route, lock, publish, and live-verification evidence directly instead of relying on worker summaries or log scanning.

补充说明
- `workflowGates` is read-only UI state; the dashboard does not let operators mark gate checks complete by hand.
- Missing evidence is displayed as a system closeout blocker, not as a user-authored task requirement.
- Route context from `workflowRoute` is shown with the gate so fuzzy task routing remains auditable.

[2026-04-27T17:30:00+08:00] Canonical dashboard handoff decision:
This repo now uses `PROJECT_STATUS.json` as the first current-state handoff source, `DECISIONS.md` as the durable product and rollout decision log, and `PROCESS.md` as the reusable lessons log. New sessions should route here through `~/codex/WORKSPACE_INDEX.json` instead of inferring the target from broad workspace search.

补充说明
- The operator-facing surface remains the public control-plane route `https://hernando-zhao.cn/middle`.
- Local Vite behavior is useful for development, but it does not replace served-route verification for live-facing changes.
