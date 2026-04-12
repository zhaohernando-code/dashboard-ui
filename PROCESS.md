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

- Problem: task task-mnvwpn1r-cbbcjc (bug修复和体验优化) finished with status completed.
- Resolution: Published via GitHub Contents API fallback.
- Prevention: Finalization path now records and surfaces publish outcomes to avoid silent drift.
- Commit ID: 0379611
- Context: project=dashboard-ui, source=issue #7

## 2026-04-12

- Problem: task switching could snap back to the first task after polling refreshes, while the workspace packed project/task/detail into one screen and task details could overflow on long text.
- Resolution: stabilized selected project/task state against polling with refs, rebuilt the workspace into single-level navigation with breadcrumb + back flow and level-based create dialogs, added dark mode, and hardened detail/log cards with aggressive wrapping and responsive cards.
- Prevention: any auto-refreshing selection UI must compare against current refs rather than interval-closure state, and hierarchical dashboards should expose one navigation level at a time with overflow-safe detail blocks.
- Commit ID: N/A（当前沙箱禁止写入 worktree git 索引，无法在本环境提交）
