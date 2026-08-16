// ==================== Preload 脚本（沙箱环境）====================
// electron-vite 会用 rollup 把 preload 打成【单文件】，
// 所以即使在 sandbox 下也能自由 import shared 里的常量。
import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '../shared/ipc'
import type { AssetApi } from '../shared/ipc'

/**
 * IPC 参数净化（第二道防线）：参数跨 contextBridge 边界时就会被结构化克隆，
 * Vue reactive 的 Proxy 在那一步就会抛 "An object could not be cloned"——
 * 所以 Proxy 净化只能在页面主世界做（见 renderer/composables/useElectron.ts）。
 * 这里的 plain() 兜底处理其他不可克隆的普通嵌套结构，保持桥接层健壮。
 */
function plain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value)) as T
}

const api: AssetApi = {
  // 采集
  previewCollect: () => ipcRenderer.invoke(IpcChannel.PreviewCollect),
  // 部门
  getDeptTree: () => ipcRenderer.invoke(IpcChannel.DeptTree),
  createDept: (input) => ipcRenderer.invoke(IpcChannel.DeptCreate, plain(input)),
  updateDept: (id, input) => ipcRenderer.invoke(IpcChannel.DeptUpdate, id, plain(input)),
  moveDept: (id, newParentId) => ipcRenderer.invoke(IpcChannel.DeptMove, id, newParentId),
  deleteDept: (id) => ipcRenderer.invoke(IpcChannel.DeptDelete, id),
  listDeptEmployees: (deptId) => ipcRenderer.invoke(IpcChannel.DeptEmployees, deptId),
  // 员工
  listEmployees: (query) => ipcRenderer.invoke(IpcChannel.EmpList, plain(query)),
  createEmployee: (input) => ipcRenderer.invoke(IpcChannel.EmpCreate, plain(input)),
  updateEmployee: (id, input) => ipcRenderer.invoke(IpcChannel.EmpUpdate, id, plain(input)),
  previewEmpLeft: (id) => ipcRenderer.invoke(IpcChannel.EmpPreviewLeft, id),
  markEmpLeft: (id, leaveDate) => ipcRenderer.invoke(IpcChannel.EmpMarkLeft, id, leaveDate),
  // 资产
  nextAssetNo: (category) => ipcRenderer.invoke(IpcChannel.AssetNextNo, category),
  listAssets: (query) => ipcRenderer.invoke(IpcChannel.AssetList, plain(query)),
  getAsset: (id) => ipcRenderer.invoke(IpcChannel.AssetGet, id),
  createAsset: (input) => ipcRenderer.invoke(IpcChannel.AssetCreate, plain(input)),
  updateAsset: (id, input) => ipcRenderer.invoke(IpcChannel.AssetUpdate, id, plain(input)),
  scrapAsset: (id) => ipcRenderer.invoke(IpcChannel.AssetScrap, id),
  confirmRecycle: (id) => ipcRenderer.invoke(IpcChannel.AssetConfirmRecycle, id),
  assetStats: () => ipcRenderer.invoke(IpcChannel.AssetStats),
  listCategories: () => ipcRenderer.invoke(IpcChannel.CategoryList),
  listDeviceTypes: () => ipcRenderer.invoke(IpcChannel.CategoryDeviceTypes),
  createCategory: (input) => ipcRenderer.invoke(IpcChannel.CategoryCreate, plain(input)),
  updateCategory: (id, name) => ipcRenderer.invoke((IpcChannel as any).CategoryUpdate, id, name),
  deleteCategory: (id) => ipcRenderer.invoke(IpcChannel.CategoryDelete, id),
  setCategoryDevices: (id, ids) => ipcRenderer.invoke(IpcChannel.CategorySetDevices, id, plain(ids)),
  createDeviceType: (input) => ipcRenderer.invoke(IpcChannel.DeviceTypeCreate, plain(input)),
  updateDeviceType: (id, name) => ipcRenderer.invoke(IpcChannel.DeviceTypeUpdate, id, name),
  deleteDeviceType: (id) => ipcRenderer.invoke(IpcChannel.DeviceTypeDelete, id),
  // 设备总览
  listDevices: (query) => ipcRenderer.invoke(IpcChannel.DeviceList, plain(query)),
  // 导出 / 审计
  exportExcel: (query) => ipcRenderer.invoke(IpcChannel.ExportExcel, plain(query)),
  listAudits: (limit) => ipcRenderer.invoke(IpcChannel.AuditList, limit),
  // send/on：主进程主动推送（打印/下载被拦截的管控通知）
  onAuditNotice: (cb) => {
    ipcRenderer.on(IpcChannel.AuditNotice, (_e, msg: string) => cb(msg))
  },
  // 无边框窗口控制
  windowControl: (action) => ipcRenderer.invoke(IpcChannel.WindowControl, action)
}

// contextBridge：因为开了 contextIsolation，这是网页唯一能碰到我们的"门缝"
contextBridge.exposeInMainWorld('electronAPI', api)
