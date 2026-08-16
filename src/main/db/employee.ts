// ==================== 员工 DAO ====================
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { getPool } from './connection'
import { descendantIds, deptPathMap } from './department'
import type { Asset, Employee, EmployeeInput, EmployeeQuery, PagedResult } from '../../shared/types'

export async function listEmployees(query: EmployeeQuery = {}): Promise<PagedResult<Employee>> {
  const where: string[] = []
  const params: unknown[] = []
  if (query.keyword) {
    where.push('(e.emp_no LIKE ? OR e.name LIKE ? OR e.position LIKE ?)')
    const like = `%${query.keyword}%`
    params.push(like, like, like)
  }
  if (query.deptId) {
    const ids = await descendantIds(query.deptId)
    where.push(`e.dept_id IN (${ids.map(() => '?').join(',')})`)
    params.push(...ids)
  }
  if (query.status) {
    where.push('e.status = ?')
    params.push(query.status)
  }
  const sql = `
    SELECT e.*,
      (SELECT COUNT(*) FROM assets a
        WHERE a.employee_id = e.id AND a.status != 'scrapped') AS asset_count,
      (SELECT COALESCE(SUM(GREATEST(1, COALESCE((
          SELECT SUM(ac.quantity) FROM asset_components ac WHERE ac.asset_id = a.id
        ), 0))), 0)
        FROM assets a
        WHERE a.employee_id = e.id AND a.status != 'scrapped') AS device_count
    FROM employees e
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY e.id DESC`
  const countSql = `SELECT COUNT(*) AS n FROM employees e ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`
  const [[countRow]] = await getPool().query<RowDataPacket[]>(countSql, params)
  const page = Math.max(1, query.page || 1)
  const pageSize = Math.min(200, Math.max(1, query.pageSize || 20))
  const [rows] = await getPool().query<RowDataPacket[]>(`${sql} LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
  const paths = await deptPathMap()
  return { rows: (rows as Employee[]).map((e) => ({ ...e, dept_path: paths.get(e.dept_id) ?? '' })), total: Number(countRow.n) }
}

export async function getEmployee(id: number): Promise<Employee | null> {
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT * FROM employees WHERE id = ?', [id])
  return (rows as Employee[])[0] ?? null
}

export async function createEmployee(input: EmployeeInput): Promise<number> {
  try {
    await validateEmployeeDepartment(input.dept_id)
    const [r] = await getPool().query<ResultSetHeader>(
      `INSERT INTO employees (emp_no, name, dept_id, position, hire_date)
       VALUES (?, ?, ?, ?, ?)`,
      [input.emp_no, input.name, input.dept_id, input.position ?? null, input.hire_date ?? null]
    )
    return r.insertId
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error(`工号 ${input.emp_no} 已存在`)
    }
    throw e
  }
}

export async function updateEmployee(id: number, input: EmployeeInput): Promise<void> {
  try {
    await validateEmployeeDepartment(input.dept_id)
    await getPool().query(
      `UPDATE employees SET emp_no = ?, name = ?, dept_id = ?, position = ?, hire_date = ?
       WHERE id = ?`,
      [input.emp_no, input.name, input.dept_id, input.position ?? null, input.hire_date ?? null, id]
    )
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error(`工号 ${input.emp_no} 已存在`)
    }
    throw e
  }
}

async function validateEmployeeDepartment(deptId: number): Promise<void> {
  const [[dept]] = await getPool().query<RowDataPacket[]>(
    `SELECT d.parent_id, EXISTS(SELECT 1 FROM departments c WHERE c.parent_id = d.id) AS has_children
     FROM departments d WHERE d.id = ?`, [deptId]
  )
  if (!dept) throw new Error('归属部门不存在')
  if (dept.parent_id == null) throw new Error('公司根节点不能作为员工归属部门')
  if (dept.has_children) throw new Error('员工只能挂靠叶子部门')
}

/** 离职预检（R1）：该员工名下"在用"资产 */
export async function previewEmpLeft(id: number): Promise<Asset[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT * FROM assets WHERE employee_id = ? AND status = 'inuse'`, [id]
  )
  return rows as Asset[]
}

/**
 * 标记离职（事务）：
 * 1. 员工状态 → left，记录离职日期
 * 2. 名下"在用"资产 → pending_recycle（保留 employee_id 便于追溯，IT 确认回收后才解除）
 * 返回受影响的资产数
 */
export async function markEmpLeft(id: number, leaveDate: string): Promise<number> {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [empRows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM employees WHERE id = ? FOR UPDATE', [id]
    )
    const emp = (empRows as Employee[])[0]
    if (!emp) throw new Error('员工不存在')
    if (emp.status === 'left') throw new Error('该员工已是离职状态')

    await conn.query(
      `UPDATE employees SET status = 'left', leave_date = ? WHERE id = ?`, [leaveDate, id]
    )
    const [r] = await conn.query<ResultSetHeader>(
      `UPDATE assets SET status = 'pending_recycle'
       WHERE employee_id = ? AND status = 'inuse'`, [id]
    )
    await conn.commit()
    return r.affectedRows
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
