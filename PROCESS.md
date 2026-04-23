# PROCESS

## 2026-04-23

- Problem: active dashboard docs still mixed historical GitHub Pages and release-only wording into the current operator path, even though the live product is now the IP-hosted control plane backed by the local control-server API.
- Resolution: rewrote the current README and rules around the live topology: public control-plane entrypoint, internal `127.0.0.1:8787` API, `/tools/*` static routes, and `/projects/*` dynamic routes.
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
