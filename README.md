# Dashboard UI

React + TypeScript control-plane frontend for the local Codex control plane.

## Runtime Topology

- The browser-facing entrypoint is always the `release` deployment on port `80`.
- The dashboard talks to the local control-server API on `http://127.0.0.1:8787` behind the release stack.
- External/operator documentation should point users to the `release` port `80` URL, not to Vite dev server ports or to `8787`.
- Treat `8787` as an internal API address only.

## Local development

```bash
npm install
npm run dev
```

For local development only, the app defaults to `http://localhost:8787` as its API base.

## Release Behavior

- Production builds are promoted into `release/projects/dashboard-ui/tool`.
- The served UI is the release copy behind port `80`, not the Vite development server.
- The dashboard now uses the local control-plane API directly; GitHub issue queue / GitHub-direct browser mode is retired.
- Automatic GitHub repository creation remains available only as a server-side capability when the release config includes a valid GitHub API token.
