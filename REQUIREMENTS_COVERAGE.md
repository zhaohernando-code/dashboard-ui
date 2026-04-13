# Requirements Coverage

## Snapshot

This baseline consolidates the active `dashboard-ui` task-pool requirements from GitHub issues `#4` through `#21` into one reviewed branch state.

## Requirement Groups

### Queue, Publish, and Freshness

- Issues: `#11`, `#15`, `#21`
- Covered by:
  - optimistic `pending_capture` task rows after creation
  - same-project serialized execution
  - fresh-branch/fresh-baseline publish flow in `local-control-server`
  - requirement-thread statuses instead of false `completed`

### Workspace Information Architecture

- Issues: `#7`, `#9`, `#10`, `#12`
- Covered by:
  - single-level workspace navigation
  - breadcrumb-driven drill-down
  - project-level composite-task entry
  - mobile floating control sheet and workspace drawer
  - desktop/mobile layout split with responsive width fixes

### Creation Feedback and Dialog UX

- Issues: `#11`, `#13`, `#15`, `#17`, `#19`
- Covered by:
  - fixed toast-style notices
  - dialog auto-close on successful create
  - stable form reset path without async event lifetime bugs
  - borderless close icon and tightened dialog spacing
  - desktop switch controls and logout placement adjustments

### Usage, Summary, and Log Readability

- Issues: `#4`, `#14`, `#16`, `#18`, `#20`
- Covered by:
  - member usage used/total ratio card with fallback reason
  - full summary rendering in task detail
  - server-side full summary persistence into issue comments
  - important-log-first detail view with optional raw-log expansion

### Acceptance and Requirement Tracking

- Issues: repeated regressions in `#15` to `#21`
- Covered by:
  - requirement-thread grouping
  - attempt history
  - acceptance checklist
  - explicit `awaiting_acceptance`, `needs_revision`, and `publish_failed` states

## Consolidation Rule

This version should be treated as the clean historical baseline for the current task pool. Any future retry or fix must preserve all groups above instead of re-solving a single issue in isolation.
