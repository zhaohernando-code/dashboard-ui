# PROCESS

## 2026-04-13

- Problem: after submitting an acceptance decision, the toast confirmed success but the requirement list could still show `待验收`. The requirement cards preferred the backend `requirementStatus` field over the latest attempt status already loaded in the UI, so stale or mismatched aggregation could keep the old acceptance badge visible.
- Resolution: updated [src/App.tsx](/Users/hernando_zhao/codex/.codex-system/worktrees/dashboard-ui/task-mnx4fpft-bmufsw/src/App.tsx) so `buildRequirementsFromTasks()` derives each requirement card status directly from the latest grouped attempt `status`, keeping the list aligned with the detail view after approval submission.
- Prevention: when the UI already groups attempts into a requirement thread, the displayed requirement status must come from that grouped latest attempt unless the backend aggregate is guaranteed to share the exact same requirement key and lifecycle semantics.
- Commit ID: N/A（当前回合修复后会继续做本地校验；远端推送/主线合并受环境限制）

- Problem: the dashboard lists showed status badges but offered no operator-side status filter, so users had to visually scan projects, requirements, approvals, and anomaly queues one by one to find the current state they cared about. Worktree validation also failed at first because this task branch had no local `node_modules`.
- Resolution: added a reusable status filter bar to the project list, requirement list, approval queue, and anomaly queue; project filtering now keeps only projects that contain at least one requirement in the chosen state. For validation, linked the worktree `node_modules` to the canonical repo dependency directory and then ran the normal `npm run check` and `npm run build` flow successfully.
- Prevention: any operational list that already surfaces a status badge should expose the same status as a first-class filter; for future worktrees, verify dependency availability before starting validation, and reuse the canonical repo dependencies when the worktree itself is intentionally lightweight.
- Commit ID: N/A（当前回合已完成本地类型检查与构建；未执行远端推送/主线合并）

## 2026-04-13

- Problem: anomaly queue items could only be viewed, so operators had no way to close the loop on known exceptions and the same requirement kept resurfacing even after manual follow-up.
- Resolution: added anomaly-level manual handling in the dashboard, persisted handled anomaly fingerprints in local storage, exposed mark-handled/restore actions in both the anomaly queue and task detail, and auto-reactivated alerts when the underlying anomaly content changed.
- Prevention: any operational queue item that is derived from UI-visible heuristics must provide an explicit close-loop action plus a re-alert rule tied to the anomaly fingerprint, otherwise users cannot distinguish “known and handled” from “still needs attention”.
- Commit ID: N/A（当前回合已完成本地构建校验；远端推送/主线合并受环境限制，后续提交后补充 commit ID）

## 2026-04-13

- Problem: anomaly closure was still reversible and fingerprint-based, so items that had already been closed out could resurface after detail changes even though the expected behavior was a permanent state change.
- Resolution: updated the dashboard to persist anomaly closure by stable anomaly ID, removed restore actions from the anomaly queue and detail view, and kept closed anomalies hidden across refreshes instead of re-alerting on content drift.
- Prevention: when the product defines “closed loop” as a permanent operator decision, persist it with a stable business key and do not expose UI affordances that can undo it unless that reversibility is explicitly required.
- Commit ID: N/A（当前回合修复后会继续做本地校验；远端推送/主线合并受环境限制）

## 2026-04-13

- Problem: desktop/mobile theme and language toggles still used a custom switch card with drifting labels, the toggle helper text added visual noise, the right-side approval panel felt center-aligned, and requirement/detail summaries could still be visually cut off in the dashboard UI.
- Resolution: installed `antd`, replaced the header/mobile toggle widgets with Ant Design `Switch` and `Segmented`, removed the extra helper copy under theme/language controls, pinned the approval side panel content to the top, and changed requirement/detail summary surfaces to render full wrapped text with full-width detail cards instead of preview-style clamping.
- Prevention: use framework-provided controls for binary/choice settings instead of maintaining bespoke switch animations, and never reuse preview clamp styles on user-facing task summaries that need to remain fully readable.
- Commit ID: N/A（当前回合已完成本地校验；远端推送/主线合并受环境限制，若本地提交成功会在后续记录补充 commit ID）

## 2026-04-13

- Problem: task-pool fixes had been landing as isolated issue responses, so remote `main` could still drift away from the combined historical requirement set even when individual tasks looked “done”.
- Resolution: audited dashboard task-pool issues `#4`-`#21`, grouped them into queue/publish, IA/mobile, create-feedback, and usage/log readability requirement clusters, added `REQUIREMENTS_COVERAGE.md` as the baseline checklist, and tightened task detail logs to show important events by default with raw-log expansion on demand.
- Prevention: future dashboard closures must validate against the consolidated requirement groups, not only the newest issue text; when a view mixes operational and verbose logs, default to key-event mode and make raw logs an explicit opt-in.
- Commit ID: `4aed7ea`

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
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: the dashboard still rendered flat task rows, so repeated attempts on the same requirement looked like unrelated tasks and old false `completed` states hid the real “still not done” queue shape.
- Resolution: switched the workspace to requirement-thread grouping on the client, surfaced latest attempt number/status, acceptance progress, publish status, open failure reason, and attempt history, and exposed acceptance-stage tasks in the side approval panel.
- Prevention: operational dashboards should list the user-facing requirement as the primary unit and render attempts as history beneath it; otherwise retries and partial fixes become indistinguishable from finished work.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: mobile view still allowed breadcrumb and top-level tab actions to wrap into multiple rows, which made the control path unstable and wasted vertical space during task navigation.
- Resolution: replaced mobile top tabs with a floating quick-switch sheet, converted breadcrumbs into a single-line horizontally scrollable pill path, and tightened workspace action/layout spacing for phone screens while preserving the existing desktop control-plane style.
- Prevention: any mobile control-plane navigation with more than two primary actions must default to a compact overlay/sheet pattern; breadcrumb trails on narrow screens should scroll horizontally instead of wrapping.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: composite/fuzzy task creation still lived inside a concrete project context, which forced users to guess `projectId` even when the task spanned multiple projects or needed AI to decide the target project.
- Resolution: moved the composite-task entry to the project level, split create flows into project/direct-task/composite-task modes, and encoded AI-routed work with a dedicated `__auto_route__` project marker so the payload keeps the routing intent instead of silently falling back to a fixed project.
- Prevention: when a workflow explicitly says “AI decides the target project”, the UI must not collect or infer a fixed project selector just to satisfy the current form shape; preserve that routing intent in the submitted payload and in the dashboard presentation.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: task creation could still report `Cannot read properties of null (reading 'reset')` after the backend already accepted the request, because the submit cleanup path still depended on a React form event object; the in-page notice also sat inside normal layout flow instead of behaving like a fixed toast.
- Resolution: changed create handlers to accept a concrete `HTMLFormElement` from the dialog submit wrapper, so `FormData`, `reset()`, and modal close no longer rely on async event lifetimes; replaced the single inline notice with a fixed top-center toast stack that supports success/error/info tones similar to Ant Design `message`.
- Prevention: for async form submissions, pass the DOM form node into the async action instead of keeping React event objects alive across awaits; transient feedback for dashboard actions should use a fixed overlay container rather than a layout-bound banner.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: this git worktree did not have its own `node_modules`, so `npm run build` failed before validation even started because `typescript` and `vite` could not be resolved from the worktree root.
- Resolution: reused the canonical repo dependency tree by linking the worktree `node_modules` to `/Users/hernando_zhao/codex/dashboard-ui/node_modules`, then reran the build successfully in the worktree.
- Prevention: before validating a Node/Vite worktree in this environment, check whether the worktree has a local dependency tree; if not, reuse the canonical repo dependencies explicitly instead of assuming the scripts will resolve across worktrees.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: task creation had no immediate success feedback, GitHub/local issue-backed tasks could disappear until the local poller imported them, and the dashboard did not show same-project queue order clearly enough to reduce uncertainty after submit.
- Resolution: added typed in-app notices for creation/refresh/auth/task actions, inserted optimistic "待接管" tasks into the list immediately after successful creation, surfaced per-project queue hints on cards/detail views, and auto-closed the create dialog while keeping the new task visible in the current project list.
- Prevention: any asynchronous task handoff that depends on later polling must render an immediate optimistic record plus explicit queue/capture copy instead of relying on a later refresh to prove success.
- Commit ID: `e806aed`

## 2026-04-13

- Problem: after creating a task, the mobile dialog could stay open with no visible success feedback even though the backend had already started processing the task.
- Resolution: cached the form element before the async submit path in both create handlers, so post-submit `reset()` and dialog close no longer depend on `event.currentTarget` remaining valid after `await`.
- Prevention: in React async form handlers, never read `event.currentTarget` after an awaited request; capture the form element synchronously at the top of the handler and use that stable reference for cleanup.
- Commit ID: N/A（当前沙箱禁止写入主仓库 `.git/worktrees/...` 索引，无法在本环境提交）

## 2026-04-13

- Problem: the usage overview only showed task counters and could not express the current member quota used/total ratio; when quota data was missing, the UI fell back to a blank state without explaining why.
- Resolution: extended the usage view to normalize optional member quota fields from `/api/usage`, added a dedicated used/total ratio card with progress bar, and surfaced explicit summary reasons for missing quota data, backend fetch failures, and GitHub Pages direct mode.
- Prevention: any dashboard metric panel that depends on optional backend fields must keep a human-readable unavailable reason in state instead of collapsing to generic empty UI; frontends consuming evolving APIs should normalize compatible field aliases at the boundary.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: task creation still lacked clear success/failure feedback, queued tasks were invisible before the backend poller imported them, and the PC header kept outdated queue/current-user prompt boxes while theme/language controls did not match the requested switch interaction.
- Resolution: added transient creation/error notices, auto-closed the create dialog on success, inserted optimistic `pending_capture` tasks so newly queued work stays visible with a dedicated “待捕获” state, converted PC theme/language controls to switch cards, replaced close text buttons with `×`, removed the old queue/current-user strip, and moved logout to the far right of the desktop header.
- Prevention: any queue-backed creation flow must render an optimistic record immediately after a successful submit, and desktop control-bar requests should be implemented by sharing the same interaction primitive across mobile/desktop instead of maintaining separate button patterns that drift.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: the create-task dialog regressed again: submit success could still leave the modal open with no visible completion path, and the modal close icon/title spacing no longer matched the expected dashboard dialog spec.
- Resolution: captured the form element synchronously before any awaited request in both create handlers, then used that stable reference for `reset()` and close; added dialog-scoped header spacing and a borderless close icon treatment aligned with Ant Design style expectations.
- Prevention: when a previous bug fix depends on an async event-handling invariant, keep that invariant in follow-up refactors and verify the full UX path manually after submit; modal-specific affordances must use dialog-scoped styles instead of inheriting generic icon-button chrome.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: task detail summaries still ended with `...` because the issue-status sync path reused a log-style truncation helper when posting `Summary:` back to GitHub, so the dashboard could only read the shortened text.
- Resolution: removed summary truncation from `local-control-server/server.js` issue status comments so task detail views can render the full summary text while keeping log-line truncation unchanged elsewhere.
- Prevention: never reuse preview/log truncation helpers for persisted detail fields; if a string is later used as canonical detail content, store the full text and clamp only in explicitly preview-only UI surfaces.
- Commit ID: `4aed7ea`

## 2026-04-13

- Problem: task task-mnwmu69o-xgjng2 (摘要还是显示不全！！！！) finished with status completed.
- Resolution: Published via GitHub Contents API fallback.
- Prevention: Finalization path now records and surfaces publish outcomes to avoid silent drift.
- Commit ID: 9f98cfe
- Context: project=dashboard-ui, source=issue #20

## 2026-04-13

- Problem: task task-mnwmyori-mg02r6 (switch的改变被莫名回退了) finished with status completed.
- Resolution: Auto-publish warning: On branch task/task-mnwmyori-mg02r6
Changes not staged for commit:
  (use "git add/rm <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	deleted:    WORKSPACE_CONTEXT.md
	deleted:    task-brief.md

no changes added to commit (use "git add" and/or "git commit -a")

- Prevention: Finalization path now records and surfaces publish outcomes to avoid silent drift.
- Commit ID: `856655e`
- Context: project=dashboard-ui, source=issue #21

## 2026-04-13

- Problem: published or awaiting-acceptance tasks could still surface worker-only environment blockers such as missing worktree dependencies, `npm run build` limitations, or “still need commit/push” text even after the control plane had already published successfully, and the sidebar mixed true approvals with acceptance-stage tasks.
- Resolution: switched the dashboard to prefer user-facing summaries from the control plane, kept approval cards limited to `waiting_user` tasks, and rendered structured `userAction` details instead of free-form worker leftovers.
- Prevention: the UI must never infer user action from raw worker text; only explicit server-side user-action metadata may enter the pending-approval rail, and published tasks must render normalized user-facing summaries only.
- Commit ID: pending

## 2026-04-13

- Problem: in GitHub Pages direct mode, every requirement detail showed an empty critical-log section even when the backing GitHub issue already had execution comments.
- Resolution: traced the issue to `refreshTasks()` building remote tasks with `logs: []`, added issue-comment parsing so GitHub comments become ordered task logs, filtered slash-command control comments like `/approve` and `/retry`, and broadened important-log matching so common state-change comments are kept in the key-log view.
- Prevention: when adding or refactoring a remote task adapter, verify every detail-card data source end-to-end instead of only status/summary fields; if the UI has a fallback "show recent logs" path, make sure the upstream adapter still populates the raw log collection.
- Commit ID: pending

## 2026-04-13

- Problem: task `task-mnwum040-vyh1ac` completed implementation and local build in its task branch, but finalization stalled and the changes never reached `main`, leaving the task looking “still running for a long time” even though the worker had already produced a final summary.
- Resolution: recovered the finished task from `task/task-mnwum040-vyh1ac`, reapplied the published UI files onto `main`, rebuilt locally, and completed the release from the canonical repository instead of waiting on the stalled worktree finalization path.
- Prevention: when a task already has a finished summary but `main` has not moved, treat it as a finalization/publish recovery incident rather than a still-running worker; recover from the task branch immediately and record the release path.
- Commit ID: pending

## 2026-04-13

- Problem: task task-mnwslvvq-03y8jh (ui优化) finished with status awaiting_acceptance.
- Resolution: Published via GitHub Contents API fallback.
- Prevention: Finalization path now records and surfaces publish outcomes to avoid silent drift.
- Commit ID: 02f1a2a
- Context: project=dashboard-ui, source=issue #16

## 2026-04-13

- Problem: task task-mnwwjbsg-w4ele2 (解决关键日志确缺失问题) finished with status awaiting_acceptance.
- Resolution: Published via GitHub Contents API fallback.
- Prevention: Finalization path now records and surfaces publish outcomes to avoid silent drift.
- Commit ID: 5995c0a
- Context: project=dashboard-ui, source=issue #23

## 2026-04-13

- Problem: the dashboard could show individual task states but not whether the task-dispatch substrate itself was healthy, so operators had to infer poller, publish, and backlog risk indirectly.
- Resolution: added a platform-health section to the usage view, including issue-poller state, GitHub API pressure, recent publish method, and anomaly backlog counts.
- Prevention: if the product depends on a background task platform, the UI must expose platform-level health directly; otherwise users will keep discovering infrastructure problems only after task delivery fails.
- Commit ID: `42a74a9`

## 2026-04-13

- Problem: after the backend started classifying old resolved failures as archived history, the dashboard status enum still had no presentation state for those superseded attempts, which would make the UI treat them like unknown data.
- Resolution: added a `superseded` task status label and parser support so archived historical attempts render as resolved history instead of active failures.
- Prevention: whenever the control plane introduces a new operator-facing presentation state, the dashboard status model and parser must be updated in the same rollout.
- Commit ID: pending

## 2026-04-13

- Problem: the workspace project layer could read as vertically centered instead of anchored to the top, and the usage overview was too cramped while also lacking Codex CLI-style `5h limit` and `weekly limit` surfaces.
- Resolution: anchored workspace panels and entity grids to top-start, loosened card spacing for the usage page, and added frontend-compatible parsing/rendering for `rate_limits.primary/secondary` style usage windows with graceful fallbacks when the backend does not expose them yet.
- Prevention: operator dashboards should explicitly pin browse/listing surfaces to top-start and treat quota windows as first-class summary cards instead of burying them inside dense statistic grids; when a CLI status shape is the reference, add tolerant field parsing before backend rollout completes.
- Commit ID: pending

## 2026-04-13

- Problem: the usage overview still felt cramped because the section headings collapsed directly into the next grid and the usage cards kept the same dense spacing as the rest of the control plane, which made the quota area hard to scan quickly.
- Resolution: increased spacing between usage sections, widened the usage-card gaps/padding, and included the latest CLI status snapshot timestamp in the fallback summary when member used/total quota values are unavailable.
- Prevention: quota/operator summary surfaces need their own spacing scale instead of inheriting generic card density; when the backend only exposes a partial CLI snapshot, the UI should say which snapshot it is using and why full quota totals are still missing.
- Commit ID: `a1000e9`

## 2026-04-13

- Problem: status filters were added to the pending-approval rail and anomaly queue even though those queues are already singular-purpose, and the remaining desktop filters rendered on a separate row to the right of the section title which broke the control-plane header rhythm.
- Resolution: removed status filtering from approvals and anomalies, moved the project/requirement status filter into the same header row as the workspace title, and kept mobile fallback wrapping only for narrow screens.
- Prevention: only add filters where they reduce ambiguity in multi-state lists, and when a filter belongs to a list header, compose it inside the same header container first instead of bolting on an extra row.
- Commit ID: pending
