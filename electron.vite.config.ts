// electron-vite 配置：一个文件管三个目标（main / preload / renderer）
// - main/preload 打成 CommonJS（package.json 无 type:module，沙箱 preload 必须 CJS）
// - preload 会被 rollup 打成单文件 → 可以自由 import shared 常量
// - renderer 是标准 Vite + Vue3 工程
// pnpm 的 Electron 链接包可能没有 version 字段，electron-vite 会因此在启动时对
// undefined 调用 split()。从项目 package.json 推导主版本，兼容 npm/pnpm 安装方式。
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const projectPackage = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
const electronSpec = projectPackage.devDependencies?.electron ?? projectPackage.dependencies?.electron ?? ''
const electronMajor = electronSpec.match(/\d+/)?.[0]
if (electronMajor && !process.env.ELECTRON_MAJOR_VER) {
  process.env.ELECTRON_MAJOR_VER = electronMajor
}
const electronExecutable = path.resolve(
  process.cwd(),
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'Electron'
)
if (fs.existsSync(electronExecutable) && !process.env.ELECTRON_EXEC_PATH) {
  process.env.ELECTRON_EXEC_PATH = electronExecutable
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [vue(), tailwindcss()]
  }
})
