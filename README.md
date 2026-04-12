# Dashboard UI

React + TypeScript control-plane frontend intended for GitHub Pages.

## Local usage

```bash
npm install
npm run dev
```

Set the API base URL in the UI if your local server is not on `http://localhost:8787`.

## Publish

GitHub Actions builds the Vite app and publishes `dist/` to GitHub Pages.

For multi-device usage, set repository variable `VITE_DEFAULT_API_BASE` (for example `https://api.example.com`) so the published UI uses that backend URL by default.

If you use GitHub-issue queue mode, create tasks from repository issues with label `codex-task` (template: `.github/ISSUE_TEMPLATE/codex-task.md`).
The dashboard "Create" forms also submit to issue queue mode via backend endpoint `/api/issue-tasks` when server reports `taskBackend=github-issues`.
