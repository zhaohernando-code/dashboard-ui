# Dashboard UI Rules

- Preserve the existing control-plane visual language unless a deliberate redesign is requested.
- UI style reference for this dashboard: layered control-plane panels with restrained glassmorphism, clear hierarchy, and focused single-level navigation instead of dense multi-column stacking.
- Mobile interaction reference for this dashboard: adopt a compact control-center pattern with a floating entry button, bottom/right anchored quick-switch sheet, and horizontally scrollable path pills instead of wrapped multi-row nav controls.
- Build UI work as a formal TypeScript + React application, using a modern framework/toolchain instead of ad-hoc static scripts.
- Keep the dashboard deployable to GitHub Pages from a build output directory.
- Reflect task states, approvals, and summaries clearly; do not surface raw CLI noise by default.
