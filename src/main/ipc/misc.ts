// ==================== IPC：设备总览 / 导出 / 审计 ====================
import { app, dialog, shell } from 'electron'
import path from 'path'
import { IpcChannel } from '../../shared/ipc'
import { handle } from './handle'
import { listDevices } from '../db/device'
import { listAssetsWithComponents } from '../db/asset'
import { listAudits, insertAudit } from '../db/audit'
import { exportLedger } from '../services/exporter'
import type {
  AssetQuery, AuditRecord, DeviceQuery, DeviceRow, PagedResult
} from '../../shared/types'

export function registerMiscIpc(): void {
  handle<[DeviceQuery], PagedResult<DeviceRow>>(IpcChannel.DeviceList, (query) => listDevices(query))

  // 导出台账：先弹系统"另存为"对话框，取消则返回 null
  handle<[AssetQuery], string | null>(IpcChannel.ExportExcel, async (query) => {
    const date = new Date().toISOString().slice(0, 10)
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出资产台账',
      defaultPath: path.join(app.getPath('documents'), `资产台账-${date}.xlsx`),
      filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }]
    })
    if (canceled || !filePath) return null

    const { assets, components } = await listAssetsWithComponents(query)
    const file = await exportLedger(assets, components, filePath)
    // 审计记录导出条数与筛选条件（PRD §3.7）
    await insertAudit(
      'export',
      `导出台账Excel: ${file}，资产 ${assets.length} 条 / 组件 ${components.length} 行，筛选条件: ${JSON.stringify(query)}`
    )
    shell.showItemInFolder(file)
    return file
  })

  handle<[number?], AuditRecord[]>(IpcChannel.AuditList, (limit) => listAudits(limit))
}
