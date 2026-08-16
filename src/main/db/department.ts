// ==================== 部门（组织架构树）DAO ====================
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from './connection';
import type { Department, DepartmentNode, Employee } from '../../shared/types';
import type { DeptInput } from '../../shared/ipc';

async function allDepartments(): Promise<Department[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT * FROM departments ORDER BY sort, id',
  );

  return rows as Department[];
}

/** id → 完整路径名（如 研发中心/前端组），员工/资产列表展示用 */
export async function deptPathMap(): Promise<Map<number, string>> {
  const depts = await allDepartments();
  const byId = new Map(depts.map((d) => [d.id, d]));
  const cache = new Map<number, string>();
  const pathOf = (id: number): string => {
    const hit = cache.get(id);

    if (hit) return hit;
    const d = byId.get(id);

    if (!d) return '';
    const p = d.parent_id != null && byId.has(d.parent_id) ? `${pathOf(d.parent_id)}/${d.name}` : d.name;

    cache.set(id, p);
    return p;
  };

  for (const d of depts) pathOf(d.id);
  return cache;
}

/** 某部门的所有子孙部门 id（含自身）——删除保护 R8、部门员工面板都要用 */
export async function descendantIds(deptId: number): Promise<number[]> {
  const depts = await allDepartments();
  const childrenOf = new Map<number | null, Department[]>();

  for (const d of depts) {
    const list = childrenOf.get(d.parent_id) ?? [];

    list.push(d);
    childrenOf.set(d.parent_id, list);
  }
  const result: number[] = [];
  const walk = (id: number): void => {
    result.push(id);
    for (const c of childrenOf.get(id) ?? []) walk(c.id);
  };

  walk(deptId);
  return result;
}

export async function getDeptTree(): Promise<DepartmentNode[]> {
  const pool = getPool();
  const depts = await allDepartments();
  // 每个部门的直接在职员工数
  const [counts] = await pool.query<RowDataPacket[]>(
    'SELECT dept_id, COUNT(*) AS n FROM employees WHERE status = \'active\' GROUP BY dept_id',
  );
  const countMap = new Map((counts as RowDataPacket[]).map((c) => [c.dept_id as number, c.n as number]));

  const nodes = new Map<number, DepartmentNode>();

  for (const d of depts) {
    nodes.set(d.id, {
      ...d,
      children: [],
      emp_count: countMap.get(d.id) ?? 0, 
    });
  }
  const roots: DepartmentNode[] = [];

  for (const n of nodes.values()) {
    if (n.parent_id != null && nodes.has(n.parent_id)) {
      nodes.get(n.parent_id)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

export async function createDept(input: DeptInput): Promise<number> {
  const [r] = await getPool().query<ResultSetHeader>(
    'INSERT INTO departments (name, parent_id, remark, sort) VALUES (?, ?, ?, ?)',
    [input.name, input.parent_id, input.remark ?? null, input.sort ?? 0],
  );

  return r.insertId;
}

export async function updateDept(id: number, input: Partial<DeptInput>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?'); values.push(input.name); 
  }
  if (input.remark !== undefined) {
    fields.push('remark = ?'); values.push(input.remark); 
  }
  if (input.sort !== undefined) {
    fields.push('sort = ?'); values.push(input.sort); 
  }
  if (fields.length === 0) return;
  values.push(id);
  await getPool().query(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, values);
}

/** 更换上级：禁止挂到自己或自己的子孙节点下（成环） */
export async function moveDept(id: number, newParentId: number | null): Promise<void> {
  if (newParentId != null) {
    if (newParentId === id) throw new Error('不能把部门挂到自己下面');
    const descendants = await descendantIds(id);

    if (descendants.includes(newParentId)) {
      throw new Error('不能把部门挂到它自己的子孙部门下面');
    }
  }
  await getPool().query('UPDATE departments SET parent_id = ? WHERE id = ?', [newParentId, id]);
}

/** 删除保护：R7 有子部门不允许删；R8 （含子孙部门）有员工不允许删 */
export async function deleteDept(id: number): Promise<void> {
  const pool = getPool();
  const [children] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS n FROM departments WHERE parent_id = ?', [id],
  );

  if ((children[0] as { n: number }).n > 0) {
    throw new Error('该部门下还有子部门，请先删除或移走子部门');
  }
  const ids = await descendantIds(id);
  const placeholders = ids.map(() => '?').join(',');
  const [emps] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM employees WHERE dept_id IN (${placeholders})`, ids,
  );

  if ((emps[0] as { n: number }).n > 0) {
    throw new Error('该部门（含下级部门）下还有员工，请先调整员工归属');
  }
  await pool.query('DELETE FROM departments WHERE id = ?', [id]);
}

/** 某部门（含所有子孙部门）的员工列表 */
export async function listDeptEmployees(deptId: number): Promise<Employee[]> {
  const ids = await descendantIds(deptId);
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT * FROM employees WHERE dept_id IN (${placeholders}) ORDER BY id DESC`, ids,
  );
  const paths = await deptPathMap();

  return (rows as Employee[]).map((e) => ({
    ...e,
    dept_path: paths.get(e.dept_id) ?? '', 
  }));
}
