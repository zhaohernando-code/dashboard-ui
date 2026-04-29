# dashboard-ui

控制平面前端（操作员看板）。部署到 VPS 由控制面代理服务。

**技术栈**：React 18 + TypeScript + Vite 4 + Ant Design 6

## 命令

```bash
npm run dev         # Vite dev (localhost:5173)
npm run build       # typecheck + production build
npm run check       # tsc --noEmit (typecheck only)
```

## 已知陷阱

见根级 [KNOWN_TRAPS.md](../../KNOWN_TRAPS.md)，重点关注：
- #6 Vite preview vs dev base 路径
- #8 Ant Design v6 Form API 变化
- #9 import type vs 运行时 import

## 关键路径

| 文件 | 用途 |
|------|------|
| `src/App.tsx` | 入口与编排 |
| `src/dashboardController.tsx` | 中央状态控制器 |
| `src/dashboardClient.ts` | 控制面 API 客户端 |
| `src/dashboardTask*.ts` | 任务列表与操作 |

## 项目文档

见 PROJECT_STATUS.json、PROJECT_RULES.md（含详细 UI 规范）、REQUIREMENTS_COVERAGE.md
