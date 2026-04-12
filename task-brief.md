# Codex Task Brief
Task ID: task-mnvv496v-mst8zu
Task type: task
Title: [Task] sync-fallback-smoke
## User intent
Create file FALLBACK_SYNC_SMOKE.md with one line: synced
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

## 冲突处理
如果遇到用户需求会产生一个用户需求点外的严重冲突，对此任务进行pending，然后交由用户在前端进行选择或者追加内容

## 错误处理
遇到错误优先**解决错误**
不遇到必须由用户本身处理的问题不要主动进行任务停止，而是先思考如何解决问题
比如：当用户提了一个任务但发生了一个server侧的错误的时候，也对server进行修复并提交，并在log内写明

# ui风格
如果项目涉及到ui，在 https://github.com/VoltAgent/awesome-design-md 里根据项目类型和功能去寻找合适的风格，尽量不要选用和已有项目差距太大的风格，选择完后记得把这个风格的规约放入项目的遵循规范
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