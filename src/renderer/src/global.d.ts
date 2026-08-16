// 渲染进程的全局类型声明：window.electronAPI 的类型来自 shared 契约层
/// <reference types="vite/client" />

import type { AssetApi } from '../../shared/ipc'

declare global {
  interface Window {
    electronAPI: AssetApi
  }
}

export {}
