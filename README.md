# 资产台账管理系统（Electron + Vue3 + TypeScript 面试项目）

采集规则已更新：重复设备不重复入库、磁盘仅统计总容量、不采集用户名、保存独立 MAC。详见 `docs/COLLECTION_RULES.md`。

真实可运行的 Electron 桌面应用：从"单机采集工具"升级为"IT 资产台账管理系统"。
配套文档：[PRD](docs/prd/V0.1.0/PRD.md) · [开发计划](docs/develop/开发计划V0.1.0.md) · [迭代日志](docs/changelogs/V0.1.0.md)

## 技术栈

Electron 37 · Vue 3 · vue-router · Element Plus · TypeScript · electron-vite · MySQL（mysql2）· exceljs · electron-builder

## 功能

- **组织架构**：部门树（无限层级、增删改、更换上级），删除保护（有子部门/有员工拒删）
- **员工管理**：增改查、挂任意层级部门、离职联动（名下在用资产自动转"待回收"）
- **资产登记**：四分区表单（基本信息/价值信息/设备清单动态行/备注），编号自动生成
  `IT-{分类}-{年}-{序号}`，「自动提取本机配置」一键填充 CPU/内存/硬盘
- **资产台账**：分类/状态/部门/关键词筛选 + 分页 + 统计卡片 + 详情抽屉 + 报废/回收
- **设备总览**：跨资产的组件平铺视图（"全公司显示器分布"一筛即得），行点击跳资产详情
- **折旧净值**：直线折旧法，shared 层纯函数——前端实时预览与后端入库同源
- **本机采集**：采集入库 + 按 hostname+MAC 匹配资产档案，自动刷新其"自动"组件行
- **台账导出**：双 sheet（台账 + 组件明细），审计记录导出条数与筛选条件
- **安全管控**：屏幕水印、打印拦截、下载拦截、全量审计日志（只读页）
- **安全基线**：contextIsolation + sandbox + nodeIntegration:false + CSP + 最小权限 Preload

## 使用说明

### 1. 换电脑前需要准备什么

- Windows 10/11（磁盘采集使用 PowerShell `Win32_LogicalDisk`）。
- Node.js 22 LTS，确认 `node -v` 可用。
- pnpm 11，安装：`corepack enable`，然后用 `pnpm --version` 验证。
- MySQL 8.x（本机或局域网服务器均可）。当前账号必须有创建数据库和表的权限。
- Git，用于拉取项目代码。

### 2. 获取代码和安装依赖

在项目根目录（能看到 `package.json` 的目录）执行。推荐使用 pnpm，项目已包含 `pnpm-lock.yaml`：

```powershell
git clone <项目地址>
cd electron-demo
pnpm i
```

如果 pnpm 提示 `ERR_PNPM_IGNORED_BUILDS`，允许 Electron 和 esbuild 执行安装脚本：

```powershell
pnpm approve-builds --all
pnpm i
```

如果后续出现 `Electron failed to install correctly`、`Electron uninstall` 或找不到
`electron.exe`，说明 Electron 二进制没有下载完成。使用镜像重新下载：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
pnpm rebuild electron
pnpm exec electron --version   # 应输出 v37.x
```

删除依赖重装时只删除 `node_modules`，不要删除 `pnpm-lock.yaml`、`pnpm-workspace.yaml` 或源码：

```powershell
Remove-Item -Recurse -Force .\node_modules
pnpm i
```

### 3. 配置 MySQL

复制配置模板并填写真实密码。Windows PowerShell 用下面的命令：

```powershell
Copy-Item .\db.config.example.json .\db.config.json
notepad .\db.config.json
```

配置示例：

```json
{
  "host": "localhost",
  "port": 3306,
  "user": "root",
  "password": "你的MySQL密码",
  "database": "asset_inventory"
}
```

首次启动时，程序会连接 MySQL、自动创建 `asset_inventory` 数据库和业务表，不需要手工执行建表 SQL。
`db.config.json` 含密码，已被 `.gitignore` 忽略，换电脑需要重新创建。

### 4. 启动开发模式

```powershell
pnpm run dev
```

启动成功后会打开 Electron 窗口，同时启动 Vite 开发服务（通常是 `http://localhost:5173`）。
终端保持运行，修改 Vue/TypeScript 文件后会触发热更新；按 `Ctrl+C` 停止开发服务。

### 5. 首次使用顺序

1. 确认 MySQL 已启动，且 `db.config.json` 的账号密码正确。
2. 启动应用，等待数据库初始化完成。
3. 进入“组织架构”检查部门树，或按需新增部门。
4. 进入“员工管理”录入员工；资产登记时的使用人从这里选择。
5. 进入“资产登记”创建资产，可点击“自动提取本机配置”填入 CPU、内存、磁盘总容量和主机名/MAC。
6. 进入“本机采集”执行采集入库。相同设备再次采集只会提示“已采集”，不会生成重复记录。
7. 进入“资产台账”核对资产状态、归属员工、设备组件，并按需导出 Excel。

采集不会读取 Windows 当前登录用户名；“使用人”必须在资产登记页面人工选择。磁盘只保存所有固定磁盘的总容量，MAC 地址单独保存并参与资产匹配。

### 6. 常用命令

```powershell
pnpm run build    # 构建 main / preload / renderer，输出到 out/
pnpm start        # 先构建，再以生产模式启动 Electron
pnpm run smoke    # 构建并执行无界面冒烟测试
pnpm run ipc-test # 构建并执行 IPC 链路测试
pnpm run clean    # 清空资产、组件、采集、审计数据，保留部门和员工
pnpm run seed:rich # 生成至少 50 名员工、30 条丰富演示资产及唯一设备清单（幂等）
pnpm run dist     # 构建 Windows NSIS 安装包，输出到 release/
```

`pnpm run clean` 会真实清空 MySQL 中的业务数据，只在测试库使用。需要彻底重置数据库时，可删除
`asset_inventory` 数据库后重新启动应用；不要在生产库执行。

`pnpm run seed:rich` 直接连接 `db.config.json` 中配置的 MySQL，补充多种资产分类、设备类型及分类关联，将员工补足到至少 50 人、资产补足到至少 30 条；每条资产至少包含一条设备清单，演示设备的品牌型号和序列号保持唯一，办公电脑还包含 CPU、内存、硬盘和 MAC 等配置信息。脚本同时为生成的资产写入登记审计日志。该脚本不会清空或覆盖已有资产，员工达到 50 人且资产达到 30 条后重复执行不会继续新增。需要重新生成一套演示数据时，先执行 `pnpm run clean`，再执行 `pnpm run seed:rich`；清理脚本会保留部门和员工，清空资产、设备清单、采集记录和审计日志。仅应在开发或测试数据库执行。

### 7. 打包和交付

执行 `pnpm run dist` 后，安装包会生成在 `release/`。打包前确认：

- `db.config.json` 已配置，并且目标电脑能访问对应 MySQL；
- `pnpm run build` 已成功；
- `out/` 和 `release/` 是构建产物，不需要提交 Git；
- 当前实现会从应用目录读取 `db.config.json`，交付安装包时必须把该文件放在应用可读取的位置。

### 8. 常见问题

| 现象 | 处理 |
| --- | --- |
| `pnpm` 命令不存在 | 执行 `corepack enable`，重新打开终端后检查 `pnpm --version`。 |
| `ERR_PNPM_IGNORED_BUILDS` | 执行 `pnpm approve-builds --all`，再执行 `pnpm i`。 |
| `Electron failed to install correctly` | 设置 `ELECTRON_MIRROR` 后执行 `pnpm rebuild electron`。 |
| `Can't connect to MySQL server` | 确认 MySQL 服务已启动、端口可访问、host/port/账号/密码正确。 |
| `Access denied for user` | 给配置账号授予创建数据库和表的权限，或改用有权限的账号。 |
| 应用启动后页面空白 | 先执行 `pnpm run build`；检查终端中的主进程错误，不要只看浏览器控制台。 |
| 端口 5173 被占用 | 关闭已有开发进程，或结束占用该端口的进程后再执行 `pnpm run dev`。 |

### 9. 重要文件说明

- `db.config.json`：本机 MySQL 连接配置，不提交 Git。
- `db.config.example.json`：配置模板，可复制为 `db.config.json`。
- `pnpm-lock.yaml`：pnpm 依赖锁定文件，换电脑安装时保留。
- `pnpm-workspace.yaml`：允许 Electron、esbuild 安装脚本运行的 pnpm 配置，保留。
- `out/`：electron-vite 构建产物，可删除并重新生成。
- `release/`：electron-builder 安装包输出，可删除并重新生成。
- `docs/COLLECTION_RULES.md`：采集去重、磁盘、用户名、MAC 字段的详细规则。

> 数据库表包括 `departments`、`employees`、`assets`、`asset_components`、`collect_records` 和 `audits`。
> 启动时会自动建表；旧版采集表会自动迁移为 `collect_records`。

## 目录结构

```
electron.vite.config.ts     # 一个配置管三端：main / preload / renderer
src/
├── main/                   # 主进程（Node 环境）
│   ├── index.ts            # 入口：app 生命周期、冒烟模式（每里程碑追加断言）
│   ├── window.ts           # 建窗口 + 打印/下载管控
│   ├── ipc/                # invoke/handle 按业务模块拆分
│   │   ├── index.ts        # 注册入口
│   │   ├── handle.ts       # 类型化 handle 包装
│   │   ├── department.ts / employee.ts / asset.ts / collect.ts / misc.ts
│   ├── db/                 # 数据层
│   │   ├── connection.ts   # mysql2 连接池（dateStrings 避免时区坑）
│   │   ├── schema.ts       # 建表 + 旧表迁移 + 部门种子数据（全幂等）
│   │   ├── department.ts / employee.ts / asset.ts / device.ts / collect.ts / audit.ts
│   │   └── index.ts        # 统一出口
│   └── services/
│       ├── collector.ts    # 资产采集（os 模块 + PowerShell CIM 查磁盘）
│       └── exporter.ts     # Excel 导出（采集记录 / 台账双 sheet）
├── preload/index.ts        # contextBridge 桥（全量 AssetApi）
├── renderer/               # 渲染进程 = 标准 Vite + Vue3 工程
│   └── src/
│       ├── router.ts       # vue-router hash 模式（file:// 协议约束）
│       ├── App.vue         # 侧栏布局壳（el-menu + router-view）
│       ├── views/          # 仪表盘/台账/登记表单/设备总览/员工/组织架构/采集/审计
│       ├── components/     # ScreenWatermark + AssetDetailDrawer（台账/设备页复用）
│       └── composables/useElectron.ts
└── shared/                 # 主/渲染共用的契约层
    ├── types.ts            # 全部实体与查询类型
    ├── depreciation.ts     # 折旧纯函数 + 展示字典（前后端同源，面试亮点）
    └── ipc.ts              # IPC 渠道常量 + AssetApi 接口定义
```

构建产物在 `out/`（out/main、out/preload、out/renderer）。
