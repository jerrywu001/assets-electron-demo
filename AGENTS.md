# 仓库指南

## 项目结构与模块组织

这是一个 Electron 37 桌面应用，渲染进程使用 Vue 3 和 TypeScript。
主进程代码位于 `src/main/`，按 IPC 处理器、MySQL 数据访问和服务拆分。
Preload 桥接代码位于 `src/preload/`；共享实体和 IPC 契约位于 `src/shared/`；
渲染进程的视图、组件、路由和样式位于 `src/renderer/src/`。构建产物生成到 `out/`，打包安装程序生成到 `release/`。

## 文档与需求变更

- 版本化 PRD 与流程图位于 `docs/prd/V0.x.x/`；开发计划按 `docs/develop/开发计划V0.x.x.md` 命名；迭代日志位于 `docs/changelogs/V0.x.x.md`。
- 每次需求调整必须同步更新对应文档的**正文**，包括功能定义、字段、流程、数据模型、验收标准和计划任务；不得仅追加更新日志覆盖旧口径。
- PRD 不记录更新日志。开发计划只记录代码改动/执行状态。产品迭代说明只写入 `docs/changelogs/`。
- 新增版本时创建新的 `docs/prd/V0.x.x/` 目录及对应 `docs/changelogs/V0.x.x.md`，并更新关联文档链接。

## 构建、测试与开发命令

使用 `pnpm install` 安装依赖。项目通过安装前校验拒绝 `npm install` 与 `yarn install`，然后使用以下命令：

```bash
pnpm run dev       # Electron + Vite development mode with HMR
pnpm run build     # Build main, preload, and renderer bundles
pnpm run smoke     # Build and run headless end-to-end smoke checks
pnpm run ipc-test  # Build and exercise IPC integration checks
pnpm run seed      # Load idempotent demonstration data
pnpm run dist      # Build an NSIS installer in release/
```

运行依赖数据库的命令前，将 `db.config.example.json` 复制为 `db.config.json`，
并填写本地 MySQL 凭据。不要提交该文件。

## 编码风格与命名约定

使用两个空格缩进；在 IPC 和数据库边界使用 TypeScript 类型；遵循现有 Vue 文件的
单引号风格。Vue 组件使用 PascalCase 命名（如 `AssetDetailDrawer.vue`），组合式
函数使用 `use` 前缀，业务模块按领域命名（如 `asset.ts`、`employee.ts`）。将共享
纯逻辑放在 `src/shared/`，确保主进程和渲染进程使用相同的契约与计算逻辑。

## 测试指南

项目目前没有配置独立的单元测试套件。使用 `pnpm run build` 验证编译，使用
`pnpm run smoke` 或 `pnpm run ipc-test` 进行集成验证；这些命令需要可用的本地
MySQL 配置。修改界面时，应在开发模式下手动验证受影响的路由，并附上相关截图。

## 提交与拉取请求指南

现有提交历史中的信息非常简短，但新提交应使用简洁的祈使句主题，例如
`Fix asset form action bar`。拉取请求应说明行为变化，列出验证命令，注明数据库或
配置变更，并为渲染进程或界面变更附上截图。功能修改应避免混入无关重构。

## 安全与配置注意事项

保留 Electron 安全配置（`contextIsolation`、沙箱、禁用 `nodeIntegration`），并
通过带类型的 preload API 处理渲染进程到主进程的访问。将数据库凭据和导出的资产
数据视为敏感信息，不要将其加入版本控制、日志、截图或测试固件。
