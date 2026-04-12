# PROCESS

## 2026-04-12

- Problem: no dashboard existed for project/task orchestration and approvals.
- Resolution: implemented a static GitHub Pages-compatible dashboard with project, task, approval, usage, and auth views.
- Prevention: extend the existing dashboard shell and API contract instead of rebuilding the control UI shape.
- Commit ID: `435ca03` bootstrap, `22b7acb` manifest

## 2026-04-12

- Problem: the initial dashboard implementation was too informal for long-term maintenance, and the first remote bootstrap pass accidentally synced `node_modules` and `dist`, creating unnecessary cleanup work.
- Resolution: migrated the dashboard to `React + TypeScript + Vite`, updated the Pages workflow to build `dist`, added `.gitignore`, and corrected the sync process to only upload source/config files.
- Prevention: new UI projects must begin as formal TS/React applications; before the first remote sync, confirm `.gitignore`, build output paths, and sync exclusions are correct.
- Commit ID: `39c17d8`, `ecbd050`

## 2026-04-12

- Problem: the task browser mixed projects, tasks, and details in one view, task selection could become unstable during polling refreshes, and long detail content could overflow the card width.
- Resolution: rebuilt the quest center as a layered `projects -> tasks -> details` flow with breadcrumbs, back navigation, context actions in a modal, selection fallback logic across refreshes, and wrapped long task content/log text; also added a dark-first theme toggle.
- Prevention: when polling mutable lists, preserve the user's active selection explicitly and only clear it when the entity truly disappears; detail surfaces must default to `overflow-wrap`/`pre-wrap` for logs, paths, and generated summaries.
