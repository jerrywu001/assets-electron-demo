// ==================== 审计日志 DAO ====================
import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from './connection';
import type { AuditRecord } from '../../shared/types';

// 所有写操作统一走这个入口（增删改资产/员工/部门、导出、报废、管控拦截）
export async function insertAudit(action: string, detail: string): Promise<void> {
  await getPool().query('INSERT INTO audits (action, detail, at) VALUES (?, ?, ?)', [action, detail, new Date().toLocaleString()]);
}

export async function listAudits(limit = 500): Promise<AuditRecord[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT * FROM audits ORDER BY id DESC LIMIT ?', [Math.min(2000, limit)],
  );

  return rows as AuditRecord[];
}
