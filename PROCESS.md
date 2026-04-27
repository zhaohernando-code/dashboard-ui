# PROCESS

## 2026-04-27

- Problem: dashboard UI docs described topology and design direction, but they did not provide one fixed current-state handoff file, so new sessions still had to guess between README, prior task notes, and backend state.
- Resolution: standardized this repo on `PROJECT_STATUS.json` + `README.md` + `PROJECT_RULES.md` + `DECISIONS.md` + `PROCESS.md`, and made the workspace route-to-repo path explicit through `~/codex/WORKSPACE_INDEX.json`.
- Prevention: future dashboard changes must update the canonical entry docs whenever operator workflow, deployment expectations, or backend contract assumptions change; local preview and runtime state are not enough as onboarding context.

## 2026-04-23

- Problem: active dashboard docs still mixed historical GitHub Pages and release-only wording into the current operator path, even though the live product is now the domain-backed `/middle` control-plane route backed by the local control-server API.
- Resolution: rewrote the current README and rules around the live topology: unified login at `/`, authenticated control-plane entrypoint at `/middle`, internal `127.0.0.1:8787` API, `/tools/*` static routes, and `/projects/*` dynamic routes.
- Prevention: dashboard README and rules must always describe the live operator surface, not retired delivery modes.
- Commit ID: pending

- Problem: system-owned recovery states can easily read like user action items, which causes operators to think they need to repair internal queue, deployment, or runtime problems manually.
- Resolution: keep dashboard copy focused on real user decisions and frame internal failures as system-owned recovery paths.
- Prevention: any new pending/recovery state in the UI must make it explicit whether the next action belongs to the operator or to the platform.
- Commit ID: pending

- Problem: frequent polling and stale deployment metadata can make an operational dashboard feel noisy or misleading even when backend state is correct.
- Resolution: keep refresh behavior completion-driven and keep project/tool visibility derived from current runtime metadata instead of stale historical flags.
- Prevention: when the dashboard reflects live orchestration state, prefer current backend truth over cached or narrative-only deployment assumptions.
- Commit ID: pending

- Problem: project creation still depended on manual tunnel env and launchd setup outside the dashboard, so the UI stopped at intent capture instead of providing a true self-service `/projects/*` onboarding path.
- Resolution: the create-project flow now captures local tunnel inputs and surfaces automation status from the local worker sync path.
- Prevention: when the dashboard offers a creation flow, it must either complete the operational setup automatically or show the remaining machine-owned status explicitly.
- Commit ID: pending

- Problem: after the platform moved to “Mac builds, server entrypoint”, dashboard-ui changes still needed a separate manual build-and-sync step before the public control plane reflected the new frontend.
- Resolution: the dashboard repo now carries an explicit deploy profile so the local worker can build the UI locally and sync the release bundle to the server automatically after successful control-plane work.
- Prevention: any server-hosted frontend in this topology should declare its publish path explicitly, otherwise “task completed” and “public UI updated” drift apart.
- Commit ID: pending
