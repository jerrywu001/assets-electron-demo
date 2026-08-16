// ==================== 采集记录 DAO ====================
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getPool } from './connection'
import type { AssetInfo, CollectRecord } from '../../shared/types'

export async function insertCollectRecord(a: AssetInfo): Promise<number> {
  const [r] = await getPool().query<ResultSetHeader>(
    `INSERT INTO collect_records
      (hostname, mac, os, cpu, cpu_cores, mem_total_mb, disks_json, nics_json, collected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.hostname, a.mac || null, a.os, a.cpu, a.cpuCores, a.memTotalMB,
      JSON.stringify(a.disks), JSON.stringify(a.nics),
      new Date().toLocaleString()
    ]
  )
  return r.insertId
}

export async function listCollectRecords(): Promise<CollectRecord[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT * FROM collect_records ORDER BY id DESC LIMIT 500'
  )
  return rows as CollectRecord[]
}

/**
 * 去重查询：本机是否已采集过。
 * 判定因子 = hostname 相同，或任一网卡 MAC 命中（防止改主机名后重复入库）。
 */
export async function findExistingRecord(
  hostname: string,
  macs: string[]
): Promise<CollectRecord | null> {
  const macCond = macs.length
    ? `OR mac IN (${macs.map(() => '?').join(',')}) OR ${macs.map(() => 'nics_json LIKE ?').join(' OR ')}`
    : ''
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT * FROM collect_records WHERE hostname = ? ${macCond} ORDER BY id DESC LIMIT 1`,
    [hostname, ...macs, ...macs.map((m) => `%${m}%`)]
  )
  return (rows[0] as CollectRecord | undefined) ?? null
}
