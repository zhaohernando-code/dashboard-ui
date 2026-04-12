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

For GitHub Pages / mobile usage, do not rely on `localhost`.
Set these repository variables for Pages builds:

- `VITE_GITHUB_TASK_REPO`: issue queue repository, for example `zhaohernando-code/dashboard-ui`

In GitHub Pages, the UI runs in GitHub-direct mode:

- connect a GitHub token from the browser
- create tasks by creating labeled issues in `VITE_GITHUB_TASK_REPO`
- send `/retry`, `/stop`, `/approve`, `/reject` as issue comments
- let the local control server keep polling GitHub and executing tasks

On local development / local desktop usage, the app still talks to `http://localhost:8787` by default.
