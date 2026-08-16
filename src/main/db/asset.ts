// ==================== 资产台账 DAO ====================
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from './connection';
import { deptPathMap, descendantIds } from './department';
import { calcNetValue } from '../../shared/depreciation';
import type {
  Asset,
  AssetComponent,
  AssetInfo,
  AssetInput,
  AssetQuery,
  AssetStats,
  PagedResult,
} from '../../shared/types';

/** 净值在应用层现算而不落库：它随"当前日期"每天变化，落库就会过期 */
function withNetValue(a: Asset): Asset {
  return {
    ...a,
    net_value: calcNetValue(a.original_value, a.condition_score), 
  };
}

/** 资产编号：IT-{分类}-{年}-{4位序号}，事务内 SELECT ... FOR UPDATE 防并发重号，唯一索引兜底 */
async function genAssetNo(category: string, conn: PoolConnection): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IT-${category}-${year}-`;
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT asset_no FROM assets WHERE asset_no LIKE ? ORDER BY asset_no DESC LIMIT 1 FOR UPDATE',
    [`${prefix}%`],
  );
  const last = (rows as { asset_no: string }[])[0]?.asset_no;
  const seq = last ? parseInt(last.slice(prefix.length), 10) + 1 : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** 表单编号预览（不入库，仅展示；并发下以入库时重算的为准） */
export async function previewAssetNo(category: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IT-${category}-${year}-`;
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT asset_no FROM assets WHERE asset_no LIKE ? ORDER BY asset_no DESC LIMIT 1',
    [`${prefix}%`],
  );
  const last = (rows as { asset_no: string }[])[0]?.asset_no;
  const seq = last ? parseInt(last.slice(prefix.length), 10) + 1 : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** 状态与归属员工联动校验（R2/R4） */
async function validateAssetInput(input: AssetInput): Promise<void> {
  if (!input.components || input.components.length === 0) {
    throw new Error('设备至少填写一个');
  }
  if (input.status === 'inuse' && !input.employee_id) {
    throw new Error('状态为"在用"时必须选择归属员工');
  }
  if (input.employee_id) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      'SELECT status FROM employees WHERE id = ?', [input.employee_id],
    );
    const emp = (rows as { status: string }[])[0];

    if (!emp) throw new Error('归属员工不存在');
    if (emp.status === 'left') throw new Error('已离职员工不可被分配新资产');
  }
}

/** MAC 地址作为设备唯一标识：忽略大小写、冒号和短横线格式差异。 */
async function validateUniqueMac(mac: string | null | undefined, excludeId?: number): Promise<void> {
  const normalized = mac?.replace(/[:-]/g, '').replace(/\s/g, '')
    .toLowerCase();

  if (!normalized) return;
  const params: unknown[] = [normalized];
  let sql = `SELECT asset_no FROM assets
             WHERE LOWER(REPLACE(REPLACE(REPLACE(mac, ':', ''), '-', ''), ' ', '')) = ?`;

  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  const [rows] = await getPool().query<RowDataPacket[]>(sql, params);

  if (rows.length > 0) throw new Error(`MAC 地址已存在，该设备已登记（资产编号：${rows[0].asset_no}）`);
}

/** 选了归属员工即"在用"（PRD §3.3） */
function normalizeStatus(input: AssetInput): AssetInput {
  if (input.employee_id && input.status === 'idle') {
    return {
      ...input,
      status: 'inuse', 
    };
  }
  return input;
}

async function insertComponents(
  conn: PoolConnection,
  assetId: number,
  components: AssetComponent[],
): Promise<void> {
  for (const c of components) {
    await conn.query(
      `INSERT INTO asset_components (asset_id, comp_type, brand_model, sn, spec, quantity, source, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetId,
        c.comp_type,
        c.brand_model ?? '',
        c.sn ?? '',
        c.spec ?? '',
        c.quantity ?? 1,
        c.source ?? 'manual',
        c.remark ?? '',
      ],
    );
  }
}

export async function createAsset(raw: AssetInput): Promise<number> {
  const input = normalizeStatus(raw);

  await validateAssetInput(input);
  await validateUniqueMac(input.mac);
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const assetNo = input.asset_no?.trim() || await genAssetNo(input.category, conn);
    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO assets
        (asset_no, category, brand_model, sn, employee_id, status, location, hostname, mac, config_cpu, config_memory, config_disk,
         original_value, condition_score, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetNo,
        input.category,
        input.brand_model ?? '',
        input.sn ?? null,
        input.employee_id ?? null,
        input.status,
        input.location ?? null,
        input.hostname ?? null,
        input.mac ?? null,
        input.config_cpu ?? null,
        input.config_memory ?? null,
        input.config_disk ?? null,
        input.original_value ?? null,
        input.condition_score ?? 10,
        input.remark ?? null,
      ],
    );

    await insertComponents(conn, r.insertId, input.components ?? []);
    await conn.commit();
    return r.insertId;
  } catch (e) {
    await conn.rollback();
    if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error(`资产编号 ${input.asset_no} 已存在`);
    }
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateAsset(id: number, raw: AssetInput): Promise<void> {
  const input = normalizeStatus(raw);

  await validateAssetInput(input);
  await validateUniqueMac(input.mac, id);
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT status FROM assets WHERE id = ? FOR UPDATE', [id],
    );
    const current = (rows as { status: string }[])[0];

    if (!current) throw new Error('资产不存在');
    if (current.status === 'scrapped') throw new Error('报废是终态，已报废资产不可再编辑');

    await conn.query(
      `UPDATE assets SET
        asset_no = ?, category = ?, brand_model = ?, sn = ?, employee_id = ?, status = ?,
        location = ?, hostname = ?, mac = ?, config_cpu = ?, config_memory = ?, config_disk = ?, original_value = ?,
        condition_score = ?, remark = ?
       WHERE id = ?`,
      [
        input.asset_no ?? '',
        input.category,
        input.brand_model ?? '',
        input.sn ?? null,
        input.employee_id ?? null,
        input.status,
        input.location ?? null,
        input.hostname ?? null,
        input.mac ?? null,
        input.config_cpu ?? null,
        input.config_memory ?? null,
        input.config_disk ?? null,
        input.original_value ?? null,
        input.condition_score ?? 10,
        input.remark ?? null,
        id,
      ],
    );
    // 组件清单整体替换（表单提交的就是全量清单；采集联动的 auto 行由 matchAndUpdateAsset 维护）
    await conn.query('DELETE FROM asset_components WHERE asset_id = ?', [id]);
    await insertComponents(conn, id, input.components ?? []);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if ((e as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new Error(`资产编号 ${input.asset_no} 已存在`);
    }
    throw e;
  } finally {
    conn.release();
  }
}

interface AssetRow extends Asset {
  emp_name: string | null;
  emp_dept_id: number | null;
}

async function attachNames(rows: AssetRow[]): Promise<Asset[]> {
  const paths = await deptPathMap();

  return rows.map((r) => {
    const { emp_dept_id, ...rest } = r;

    return withNetValue({
      ...rest,
      dept_path: emp_dept_id != null ? paths.get(emp_dept_id) ?? '' : null,
    });
  });
}

export async function listAssets(query: AssetQuery): Promise<PagedResult<Asset>> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.category) {
    where.push('a.category = ?'); params.push(query.category); 
  }
  if (query.status) {
    where.push('a.status = ?'); params.push(query.status); 
  }
  if (query.condition === 'low') where.push('a.condition_score <= 5');
  if (query.deptId) {
    const ids = await descendantIds(query.deptId);

    where.push(`e.dept_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (query.keyword) {
    where.push(`(a.asset_no LIKE ? OR EXISTS (
      SELECT 1 FROM asset_components c WHERE c.asset_id = a.id AND (c.brand_model LIKE ? OR c.sn LIKE ?)
    ))`);
    const like = `%${query.keyword}%`;

    params.push(like, like, like);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const pool = getPool();

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM assets a LEFT JOIN employees e ON e.id = a.employee_id ${whereSql}`,
    params,
  );
  const total = (countRows[0] as { n: number }).n;

  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize || 20));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, e.name AS emp_name, e.dept_id AS emp_dept_id
     FROM assets a LEFT JOIN employees e ON e.id = a.employee_id
     ${whereSql} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  return {
    rows: await attachNames(rows as AssetRow[]),
    total, 
  };
}

/** 导出用：按筛选取全量资产（不分页）+ 各自的组件清单 */
export async function listAssetsWithComponents(
  query: AssetQuery,
): Promise<{
  assets: Asset[];
  components: AssetComponent[]; 
}> {
  const { rows } = await listAssets({
    ...query,
    page: 1,
    pageSize: 10000, 
  });

  if (rows.length === 0) return {
    assets: [],
    components: [], 
  };
  const ids = rows.map((a) => a.id);
  const [comps] = await getPool().query<RowDataPacket[]>(
    `SELECT * FROM asset_components WHERE asset_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`,
    ids,
  );

  return {
    assets: rows,
    components: comps as AssetComponent[], 
  };
}

export async function getAsset(id: number): Promise<{
  asset: Asset;
  components: AssetComponent[]; 
}> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, e.name AS emp_name, e.dept_id AS emp_dept_id
     FROM assets a LEFT JOIN employees e ON e.id = a.employee_id WHERE a.id = ?`, [id],
  );
  const row = (rows as AssetRow[])[0];

  if (!row) throw new Error('资产不存在');
  const [comps] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM asset_components WHERE asset_id = ? ORDER BY id', [id],
  );
  const [asset] = await attachNames([row]);
  const components = comps as AssetComponent[];

  if (components[0] && !components[0].sn && asset.sn) components[0].sn = asset.sn;
  return {
    asset,
    components, 
  };
}

/** 报废（终态，不可回退） */
export async function scrapAsset(id: number): Promise<void> {
  const [r] = await getPool().query<ResultSetHeader>(
    'UPDATE assets SET status = \'scrapped\' WHERE id = ? AND status != \'scrapped\'', [id],
  );

  if (r.affectedRows === 0) throw new Error('资产不存在或已报废');
}

/** IT 确认回收：待回收 → 闲置，并解除员工归属 */
export async function confirmRecycle(id: number): Promise<void> {
  const [r] = await getPool().query<ResultSetHeader>(
    `UPDATE assets SET status = 'idle', employee_id = NULL
     WHERE id = ? AND status = 'pending_recycle'`, [id],
  );

  if (r.affectedRows === 0) throw new Error('资产不存在或不处于待回收状态');
}

export async function assetStats(): Promise<AssetStats> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT status, COUNT(*) AS n FROM assets GROUP BY status',
  );
  const byStatus = new Map((rows as {
    status: string;
    n: number; 
  }[]).map((r) => [r.status, r.n]));
  // 账面总净值：应用层现算求和（净值随日期变化，不落库）
  const [values] = await pool.query<RowDataPacket[]>(
    'SELECT original_value, condition_score FROM assets WHERE status != \'scrapped\'',
  );
  let totalNetValue = 0;

  for (const v of values as {
    original_value: number;
    condition_score: number; 
  }[]) {
    totalNetValue += calcNetValue(v.original_value, v.condition_score) ?? 0;
  }
  const total = [...byStatus.values()].reduce((s, n) => s + n, 0);

  return {
    total,
    inuse: byStatus.get('inuse') ?? 0,
    idle: byStatus.get('idle') ?? 0,
    repair: byStatus.get('repair') ?? 0,
    pendingRecycle: byStatus.get('pending_recycle') ?? 0,
    scrapped: byStatus.get('scrapped') ?? 0,
    totalNetValue: Math.round(totalNetValue * 100) / 100,
  };
}

/**
 * 采集联动（M4）：按 hostname + MAC 双因子匹配资产档案，
 * 命中则覆盖式更新其设备清单中的 auto 行；未命中返回 null。
 * （换网卡/改名导致误判时，可在资产表单里手工修正 hostname/MAC 绑定）
 */
export async function matchAndUpdateAsset(info: AssetInfo): Promise<string | null> {
  const pool = getPool();
  const macs = info.nics.map((n) => n.mac).filter(Boolean);
  const macSql = macs.length ? `OR mac IN (${macs.map(() => '?').join(',')})` : '';
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM assets WHERE status != 'scrapped' AND (hostname = ? ${macSql})
     ORDER BY (hostname = ?) + (mac IN (${macs.length ? macs.map(() => '?').join(',') : '\'\''})) DESC
     LIMIT 1`,
    [info.hostname, ...macs, info.hostname, ...macs],
  );
  const asset = (rows as Asset[])[0];

  if (!asset) return null;

  // 采集到的硬件 → 自动组件行
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    // 覆盖式更新：只删 auto 行，手工登记的行（显示器/电源/键鼠）不动
    // 顺便刷新匹配因子（机器改名后仍能匹配上）
    await conn.query(
      'UPDATE assets SET hostname = ?, mac = COALESCE(NULLIF(mac, \'\'), NULLIF(?, \'\')) WHERE id = ?',
      [info.hostname, info.mac, asset.id],
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return asset.asset_no;
}
