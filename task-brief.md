# Codex Task Brief
Task ID: task-mnvtz6qq-7i4bki
Task type: task
Title: [Task] publish-smoke
## User intent
Create one file named PUBLISH_SMOKE.md with one line: ok
## Plan preview
Composite task: [Task] publish-smoke
Proposed child tasks:
1. Create one file named PUBLISH_SMOKE
2. md with one line: ok

## Global rules
## 项目管理
所有项目都需要推送到github进行版本管理
每次修改完之后需要自行进行校验和测试并推送到远端并合入主线

## UI项目准则
凡是涉及前端界面的新项目，默认使用正式工程化方案：
- TypeScript
- React
- 明确的前端框架或构建工具链（默认优先 Vite，其次在有明确需求时再选 Next.js 等）
- 不再使用一次性原生脚本拼接页面作为长期方案
如果有特殊原因偏离此准则，需要在项目的 `PROJECT_RULES.md` 里明确说明原因

## 经验教训沉淀
每次遇到问题或者完成重要改动后，在 ./PROCESS.md 记录经验：
- 遇到了什么问题
- 如何解决的
- 以后如何避免
- **如果涉及提交，附加 git commit ID**
**同样的问题不要犯两次**
遇到了一个问题返工了很多次才跑通的，一定要进行记录
PROCESS.md也分为局部和总体（局部在当前项目下，总体在 ～/codex 下，判断当前问题属于项目还是全局都可以参考后记录到合适的位置）
## Project rules
# Dashboard UI Rules

- Preserve the existing control-plane visual language unless a deliberate redesign is requested.
- Build UI work as a formal TypeScript + React application, using a modern framework/toolchain instead of ad-hoc static scripts.
- Keep the dashboard deployable to GitHub Pages from a build output directory.
- Reflect task states, approvals, and summaries clearly; do not surface raw CLI noise by default.

## Execution guardrails
- Work in the current workspace or git worktree.
- You may read and coordinate across /Users/hernando_zhao/codex.
- The canonical project repository is /Users/hernando_zhao/codex/dashboard-ui.
- Solve errors first; only stop when the problem truly requires user action.
- End with a concise summary of outcome, risks, and next steps.