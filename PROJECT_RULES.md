# Dashboard UI Rules

## Product Direction

- Preserve the existing control-plane product positioning unless a deliberate redesign is requested.
- Keep the canonical project entry docs aligned: `PROJECT_STATUS.json`, `README.md`, `PROJECT_RULES.md`, `DECISIONS.md`, `PROCESS.md`, and `REQUIREMENTS_COVERAGE.md` when it is active.
- The operator-facing dashboard surface is the public control-plane entrypoint; do not document or design around exposing the internal `8787` API port directly.
- Prefer a structured operations dashboard over experimental custom layouts.
- Use Ant Design as the default component and layout system for most new UI work.
- Keep a small repo-native shell layer for branding, background, and a few product-specific interaction patterns.
- Keep the dashboard build consumable by the server-hosted control-plane route, and keep dev-only API defaults clearly separated from public entrypoint docs.
- If a control-plane change depends on backend contract updates, do not treat the dashboard update as an optional follow-up; keep the UI compatible with both the current backend and the pending rollout before promotion.

## Design Reference

- Follow the `HashiCorp` reference direction from `VoltAgent/awesome-design-md` for control-plane additions: enterprise-clean, structured, and low-noise rather than consumer-marketing styling.
- Keep new queue controls such as filters and pagination compact and utility-first; prefer standard Ant Design surfaces inside the existing shell instead of bespoke visual treatments.
- Use restrained accents and clear information hierarchy so dense operational lists stay easy to scan on both desktop and mobile.

## Layout Baseline

- Prefer Ant Design layout primitives first: `Layout`, `Flex`, `Space`, `Row`, `Col`, `Tabs`, `Drawer`, `Modal`.
- Use a single primary workspace surface per view, with optional side context panels.
- Desktop top-level view switching should render as a slim page-tab strip attached to the content area; do not duplicate auth actions inside that switcher.
- Section headers must follow one structure: `title + optional subtitle + optional actions`.
- Breadcrumb or backflow navigation should stay single-level and horizontally scrollable; do not reintroduce dense multi-row navigation.
- Mobile interaction should use compact control-center patterns built with `Drawer` instead of custom overlapping layers where possible.

## Typography

- Follow a fixed hierarchy and do not invent one-off font sizes for new blocks.
- Page title: large, strong, reserved for the top shell only.
- Section title: medium, strong, used for first-level content groups.
- Card title: medium, semibold, used for an individual panel or record.
- Body text: default readable size.
- Supporting text: one level smaller and lower contrast.
- Metric value: the only oversized text inside metric cards.
- Long-form summaries, timestamps, and other sentence-like strings must use body/supporting sizes instead of hero metric numerals.
- Do not reuse one generic utility class for subtitle, helper text, labels, and captions at the same time.

## Spacing

- Follow an 8pt rhythm by default.
- Section spacing, card padding, stack gaps, and toolbar spacing must come from shared tokens or shared component structure.
- Do not patch spacing with isolated inline `marginTop` or `marginBottom` unless there is a narrow one-off exception.
- Subtitle or helper text above a metric/value block must always have explicit spacing below it.

## Component Selection

- Prefer Ant Design components for common UI:
  - Navigation and switching: `Tabs`, `Segmented`, `Breadcrumb`, `Drawer`
  - Containers: `Card`, `Collapse`, `Descriptions`, `List`
  - Data and status: `Tag`, `Badge`, `Alert`, `Progress`, `Empty`
  - Input and actions: `Form`, `Input`, `Select`, `Checkbox`, `Button`, `Modal`
- Only build custom DOM + CSS when the interaction is clearly product-specific and not covered well by Ant Design.
- If a custom surface is needed, keep it thin and compose it from Ant Design typography and spacing conventions.

## State Presentation

- Reflect task states, approvals, anomalies, and summaries clearly; do not surface raw CLI noise by default.
- Statuses must render through a consistent status mapping, not ad-hoc colors per view.
- Approval, anomaly, and health panels should use a stable density and identical card rhythm for the same content type.
- Summaries should prioritize user-facing text over raw worker or execution text.

## Implementation Constraints

- `App.tsx` should remain an orchestration layer, not the long-term home for all page markup.
- New UI should prefer existing shared components or Ant Design primitives before adding new custom wrappers.
- When a new token or pattern is needed, add it to the shared theme/style layer first instead of hardcoding values inline.
- Avoid reintroducing large custom CSS systems when the same behavior can be expressed with Ant Design theme tokens and component props.
- Durable product or rollout decisions go to `DECISIONS.md`; reusable UI/process lessons go to `PROCESS.md`; current progress and blockers go to `PROJECT_STATUS.json`.
- Dashboard changes are not complete until the served `/middle` route reflects the expected behavior.
