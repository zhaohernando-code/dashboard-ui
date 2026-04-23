# Dashboard UI

React + TypeScript control-plane frontend for the local Codex control plane.

## Runtime Topology

- The operator-facing entrypoint is the public control-plane route, currently `http://8.152.168.133/`.
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
