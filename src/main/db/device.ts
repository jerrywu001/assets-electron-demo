// ==================== 设备总览（组件平铺视图）DAO ====================
import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from './connection'
import { deptPathMap } from './department'
import type { DeviceQuery, DeviceRow, PagedResult } from '../../shared/types'

/** asset_components 平铺查询，联表带出所属资产与归属人信息（只读视图） */
export async function listDevices(query: DeviceQuery): Promise<PagedResult<DeviceRow>> {
  const where: string[] = []
  const params: unknown[] = []
  if (query.compType) { where.push('c.comp_type = ?'); params.push(query.compType) }
  if (query.source) { where.push('c.source = ?'); params.push(query.source) }
  if (query.keyword) {
    where.push('(c.brand_model LIKE ? OR c.sn LIKE ? OR a.sn LIKE ? OR c.spec LIKE ? OR a.asset_no LIKE ?)')
    const like = `%${query.keyword}%`
    params.push(like, like, like, like, like)
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const fromSql = `
    FROM asset_components c
    JOIN assets a ON a.id = c.asset_id
    LEFT JOIN employees e ON e.id = a.employee_id
    ${whereSql}`
  const pool = getPool()

  const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${fromSql}`, params)
  const total = (countRows[0] as { n: number }).n

  const page = Math.max(1, query.page || 1)
  const pageSize = Math.min(200, Math.max(1, query.pageSize || 20))
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.*, COALESCE(NULLIF(c.sn, ''), CASE WHEN c.id = (
              SELECT MIN(c2.id) FROM asset_components c2 WHERE c2.asset_id = c.asset_id
            ) THEN a.sn ELSE '' END) AS device_sn,
            a.asset_no, a.status AS asset_status,
            e.name AS emp_name, e.dept_id AS emp_dept_id
     ${fromSql} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  )
  const paths = await deptPathMap()
  const result = (rows as (DeviceRow & { emp_dept_id: number | null; device_sn?: string })[]).map((r) => {
    const { emp_dept_id, device_sn, ...rest } = r
    return { ...rest, sn: device_sn || '', dept_path: emp_dept_id != null ? paths.get(emp_dept_id) ?? '' : null }
  })
  const unique = new Map<string, DeviceRow>()
  for (const row of result) {
    const key = `${row.asset_id}|${row.comp_type}|${row.brand_model ?? ''}|${row.sn ?? ''}`
    if (!unique.has(key)) unique.set(key, row)
  }
  return { rows: [...unique.values()], total: unique.size }
}
