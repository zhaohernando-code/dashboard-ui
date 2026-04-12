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

- Problem: usage 页面不能直接回答“当前已用量占总可用量比例”，task 日志默认展示过多噪声内容影响判断。
- Resolution: 新增 usage 主卡并优先展示 `已用 / 总可用` 与进度条占比；加入多字段兼容解析（`used/total/remaining` 等）以适配不同后端返回；task 详情日志默认仅显示关键日志，并提供 `Show all logs` 展开完整日志。
- Prevention: 之后定义 API 时优先保证 usage 返回稳定的 `used/total/remaining` 字段；日志展示遵循“关键信息默认可见、噪声默认折叠”的控制台规则。
- Commit ID: N/A（当前沙箱禁止写入 git worktree 索引，无法在本环境提交）

## 2026-04-12

- Problem: usage 卡片在部分返回字段下会把 `estimatedTokens` 误当成已用量，导致“已用/总可用占比”不准确；日志默认关键信息筛选也不够稳定。
- Resolution: 调整 usage 计算逻辑为严格优先 `used/total/remaining` 三字段并相互推导，移除 `estimatedTokens` 作为已用量兜底；补充 `remaining` 显示与 ratio 字段标准化解析。日志筛选改为“level/type + 关键词 + 噪声过滤”组合策略，默认仅显示关键日志，减少无效内容。
- Prevention: 前端 usage 口径禁止使用估算字段替代真实计量字段；日志组件统一采用“关键事件优先、原始日志按需展开”的默认策略。
- Commit ID: N/A（当前沙箱限制，无法写入 git worktree 索引）
