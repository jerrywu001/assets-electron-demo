// ==================== IPC：本机采集上报 ====================
import { IpcChannel } from '../../shared/ipc'
import { handle } from './handle'
import { collectAssetInfo } from '../services/collector'
import { insertCollectRecord, listCollectRecords, findExistingRecord } from '../db/collect'
import { matchAndUpdateAsset } from '../db/asset'
import { insertAudit } from '../db/audit'
import type { AssetInfo, CollectRecord, CollectResult } from '../../shared/types'

export function registerCollectIpc(): void {
  // 一键采集：先按 hostname+MAC 去重，已采集过则直接返回已有记录、不再入库
  /* 本机采集页已移除，仅保留登记表配置预览接口。 */
  /*
    const info = await collectAssetInfo()
    const macs = [...new Set([info.mac, ...info.nics.map((n) => n.mac)].filter(Boolean))]

    const existing = await findExistingRecord(info.hostname, macs)
    if (existing) {
      await insertAudit(
        'collect-skipped',
        `本机已采集过（记录 #${existing.id}，${existing.collected_at}），跳过重复入库`
      )
      return {
        ...info,
        id: existing.id,
        matchedAssetNo: null,
        duplicated: true,
        firstCollectedAt: existing.collected_at
      }
    }

    // 未采集过：入库 + 按 hostname+MAC 匹配资产档案并刷新其自动组件行（M4 联动）
    const id = await insertCollectRecord(info)
    const matchedAssetNo = await matchAndUpdateAsset(info)
    await insertAudit(
      'collect',
      matchedAssetNo
        ? `采集入库 id=${id}，已联动更新资产 ${matchedAssetNo} 的自动组件行`
        : `采集入库 id=${id}，本机未匹配到已登记资产`
    )
    return { id, matchedAssetNo, duplicated: false, ...info }
  }) */

  // 只采集不入库：登记表单「自动提取本机配置」按钮用
  handle<[], AssetInfo>(IpcChannel.PreviewCollect, async () => {
    const info = await collectAssetInfo()
    await insertAudit('config-preview', `获取本机配置: ${info.hostname}`)
    return info
  })

}
