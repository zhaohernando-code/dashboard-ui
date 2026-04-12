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

## 2026-04-13

- Problem: task creation had no immediate success feedback, GitHub/local issue-backed tasks could disappear until the local poller imported them, and the dashboard did not show same-project queue order clearly enough to reduce uncertainty after submit.
- Resolution: added typed in-app notices for creation/refresh/auth/task actions, inserted optimistic "待接管" tasks into the list immediately after successful creation, surfaced per-project queue hints on cards/detail views, and auto-closed the create dialog while keeping the new task visible in the current project list.
- Prevention: any asynchronous task handoff that depends on later polling must render an immediate optimistic record plus explicit queue/capture copy instead of relying on a later refresh to prove success.
- Commit ID: `e806aed`

## 2026-04-13

- Problem: the phone header still mixed queue/auth text with duplicated theme/language controls, the back button overlapped with breadcrumb navigation, and the mobile floating menu mixed workspace tabs with settings in one layer.
- Resolution: hid extra header/status content on mobile so only logo + title remain, removed the standalone back button in favor of breadcrumb-only navigation, converted theme/language actions into labeled switch-style controls, hid the login entry once authenticated, and moved the three primary tabs into a separate mobile drawer launched from the control center.
- Prevention: mobile control surfaces should separate workspace navigation from account/settings actions, avoid duplicated controls across header and floating menus, and keep top-level phone headers limited to identity-only content unless the extra status is critical.
- Commit ID: N/A（当前环境可执行代码修改与校验，但 git worktree 索引写入被沙箱拦截，无法在本环境完成 commit/push）

## 2026-04-13

- Problem: this validation run again started in a worktree without a local `node_modules`, which caused `npm run check` and `npm run build` to fail before the actual UI changes were exercised.
- Resolution: temporarily linked the worktree `node_modules` to `/Users/hernando_zhao/codex/dashboard-ui/node_modules`, completed `npm run check` and `npm run build`, then removed the link so it would not leak into git status.
- Prevention: for Node/Vite worktrees in this environment, verify dependency availability before validation and use a temporary link or install strategy that is explicitly cleaned up after checks.
- Commit ID: N/A（当前环境未执行 git 提交）
