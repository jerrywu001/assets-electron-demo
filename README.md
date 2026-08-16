# 资产台账管理系统

桌面资产台账应用。

[PRD](docs/prd/V0.1.0/PRD.md) · [流程图](docs/prd/V0.1.0/业务流程图.md) · [开发计划](docs/develop/开发计划V0.1.0.md) · [迭代日志](docs/changelogs/V0.1.0.md)

## 功能

- 部门、员工与资产台账管理
- 资产分类及关联设备类型管理
- 资产登记、设备清单、成色估值与本机配置采集
- 设备总览、Excel 导出、审计日志与安全水印
- 仪表盘统计和资产状态、分类、成色图表

## 环境

- Windows 10/11、macOS、Linux
- Node.js 22+
- pnpm 10.34.5
- MySQL 8+

项目仅允许使用 pnpm 安装依赖。

## 架构

框架、目录、进程通信和安全边界见 [架构说明](docs/架构说明.md)。

## 数据库操作

数据库初始化、清理和演示数据注入见 [数据库操作说明](docs/数据库操作.md)。

## 快速开始

```sh
pnpm i
```

复制数据库配置文件：

```powershell
# Windows PowerShell
Copy-Item .\db.config.example.json .\db.config.json
```

```sh
# macOS / Linux
cp ./db.config.example.json ./db.config.json
```

```sh
pnpm run dev
```

在 `db.config.json` 填写 MySQL 地址、账号和密码。首次启动会自动创建数据库和业务表；该文件包含凭据，不会提交到 Git。

## 常用命令

```sh
pnpm run dev        # 开发模式
pnpm run build      # 构建应用
pnpm run check      # 类型、ESLint、Stylelint 校验
pnpm run smoke      # 冒烟测试
pnpm run ipc-test   # IPC 集成测试
pnpm run dist       # 构建 Windows NSIS 安装包
```
