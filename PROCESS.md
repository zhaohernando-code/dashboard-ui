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

## 2026-04-12

- Problem: task task-mnvxjw45-hsb8z8 (bug修复和体验优化) finished with status completed.
- Resolution: Published via GitHub Contents API fallback.
- Prevention: Finalization path now records and surfaces publish outcomes to avoid silent drift.
- Commit ID: a3a9560
- Context: project=dashboard-ui, source=issue #7

## 2026-04-12

- Problem: GitHub Pages was still wired to `localhost:8787` for auth and task APIs, so mobile/outside access could open the page but could not log in or send work to the local machine.
- Resolution: added a GitHub-direct runtime for Pages builds: browser-side GitHub token connection, direct issue creation in `zhaohernando-code/dashboard-ui`, direct `/retry` `/stop` `/approve` `/reject` issue comments, and issue-based task/project views that no longer depend on the local API from mobile.
- Prevention: any public/static control-plane UI must treat `localhost` as a local-only convenience path; remote/mobile operation must use a queue/backend the browser can reach directly.
- Commit ID: pending dashboard-ui publish

## 2026-04-13

- Problem: mobile view still allowed breadcrumb and top-level tab actions to wrap into multiple rows, which made the control path unstable and wasted vertical space during task navigation.
- Resolution: replaced mobile top tabs with a floating quick-switch sheet, converted breadcrumbs into a single-line horizontally scrollable pill path, and tightened workspace action/layout spacing for phone screens while preserving the existing desktop control-plane style.
- Prevention: any mobile control-plane navigation with more than two primary actions must default to a compact overlay/sheet pattern; breadcrumb trails on narrow screens should scroll horizontally instead of wrapping.
- Commit ID: N/A（当前环境未执行 git 提交）

## 2026-04-13

- Problem: composite/fuzzy task creation still lived inside a concrete project context, which forced users to guess `projectId` even when the task spanned multiple projects or needed AI to decide the target project.
- Resolution: moved the composite-task entry to the project level, split create flows into project/direct-task/composite-task modes, and encoded AI-routed work with a dedicated `__auto_route__` project marker so the payload keeps the routing intent instead of silently falling back to a fixed project.
- Prevention: when a workflow explicitly says “AI decides the target project”, the UI must not collect or infer a fixed project selector just to satisfy the current form shape; preserve that routing intent in the submitted payload and in the dashboard presentation.
- Commit ID: N/A（当前环境未执行 git 提交）

## 2026-04-13

- Problem: this git worktree did not have its own `node_modules`, so `npm run build` failed before validation even started because `typescript` and `vite` could not be resolved from the worktree root.
- Resolution: reused the canonical repo dependency tree by linking the worktree `node_modules` to `/Users/hernando_zhao/codex/dashboard-ui/node_modules`, then reran the build successfully in the worktree.
- Prevention: before validating a Node/Vite worktree in this environment, check whether the worktree has a local dependency tree; if not, reuse the canonical repo dependencies explicitly instead of assuming the scripts will resolve across worktrees.
- Commit ID: N/A（当前环境未执行 git 提交）
