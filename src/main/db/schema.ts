// ==================== 建表 + 迁移 + 种子数据 ====================
// 全部 DDL 幂等（IF NOT EXISTS），重复启动安全。
import { getPool } from './connection'

/** 旧版 assets 表是"采集记录"表，新版 assets 是"资产台账"表——启动时自动改名迁移 */
async function migrateLegacyCollectTable(): Promise<void> {
  const pool = getPool()
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assets'`
  )
  const names = (cols as { COLUMN_NAME: string }[]).map((c) => c.COLUMN_NAME)
  // 旧表特征：有 hostname 没有 asset_no
  if (names.length > 0 && names.includes('hostname') && !names.includes('asset_no')) {
    await pool.query('RENAME TABLE assets TO collect_records')
    console.log('[db] 旧采集表 assets 已迁移为 collect_records')
  }
}

async function createTables(): Promise<void> {
  const pool = getPool()

  // 采集记录（原"一键采集"落库表，JSON 快照适合只读原始数据）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collect_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hostname VARCHAR(128), username VARCHAR(64), mac VARCHAR(64) NULL, os VARCHAR(128),
      cpu VARCHAR(256), cpu_cores INT, mem_total_mb INT,
      disks_json TEXT, nics_json TEXT,
      collected_at VARCHAR(32),
      INDEX idx_hostname (hostname)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // Existing installations may have the old snapshot table without a dedicated MAC column.
  const [collectCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collect_records'`
  )
  if (!(collectCols as { COLUMN_NAME: string }[]).some((c) => c.COLUMN_NAME === 'mac')) {
    await pool.query('ALTER TABLE collect_records ADD COLUMN mac VARCHAR(64) NULL AFTER hostname')
  }

  // 部门树：parent_id 自关联，NULL = 公司根节点；sort 控制同级排序
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      parent_id INT NULL,
      remark VARCHAR(255) NULL,
      sort INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 员工：不物理删除，用 status 收口（台账系统审计追溯优先）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emp_no VARCHAR(32) NOT NULL UNIQUE,
      name VARCHAR(64) NOT NULL,
      dept_id INT NOT NULL,
      position VARCHAR(64) NULL,
      hire_date DATE NULL,
      status ENUM('active','left') NOT NULL DEFAULT 'active',
      leave_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dept (dept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 资产台账：本版不提供物理删除，用"报废"终态代替
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asset_categories (
      id INT AUTO_INCREMENT PRIMARY KEY, value VARCHAR(32) NOT NULL UNIQUE, name VARCHAR(64) NOT NULL,
      is_preset BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.query(`CREATE TABLE IF NOT EXISTS device_types (
      id INT AUTO_INCREMENT PRIMARY KEY, value VARCHAR(32) NOT NULL UNIQUE, name VARCHAR(64) NOT NULL,
      is_preset BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  await pool.query(`CREATE TABLE IF NOT EXISTS category_device_types (
      category_id INT NOT NULL, device_type_id INT NOT NULL, PRIMARY KEY (category_id, device_type_id),
      FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE,
      FOREIGN KEY (device_type_id) REFERENCES device_types(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  const [cc] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM asset_categories')
  if (!cc[0].n) await pool.query('INSERT INTO asset_categories (value,name,is_preset) VALUES (?,?,TRUE),(?,?,TRUE),(?,?,TRUE)', ['PC','办公电脑','SRV','服务器','OTH','其他'])
  const [dt] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM device_types')
  if (!dt[0].n) await pool.query('INSERT INTO device_types (value,name,is_preset) VALUES (?,?,TRUE),(?,?,TRUE),(?,?,TRUE),(?,?,TRUE),(?,?,TRUE),(?,?,TRUE)', ['host','主机','laptop','笔记本','monitor','显示器','psu','电源','kbmouse','键鼠套装','other','其他'])
  const [rel] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM category_device_types')
  if (!rel[0].n) {
    await pool.query(`INSERT INTO category_device_types (category_id, device_type_id)
      SELECT c.id, d.id FROM asset_categories c CROSS JOIN device_types d
      WHERE c.value = 'PC' AND d.value IN ('host','laptop','monitor','psu','kbmouse','other')`)
    await pool.query(`INSERT INTO category_device_types (category_id, device_type_id)
      SELECT c.id, d.id FROM asset_categories c CROSS JOIN device_types d
      WHERE c.value IN ('SRV','OTH') AND d.value IN ('other')`)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asset_no VARCHAR(32) NOT NULL UNIQUE,
      category VARCHAR(8) NOT NULL,
      brand_model VARCHAR(128) NOT NULL DEFAULT '',
      sn VARCHAR(64) NULL,
      employee_id INT NULL,
      status ENUM('idle','inuse','repair','pending_recycle','scrapped') NOT NULL DEFAULT 'idle',
      location VARCHAR(128) NULL,
      hostname VARCHAR(128) NULL,
      mac VARCHAR(64) NULL,
      config_cpu VARCHAR(255) NULL,
      config_memory VARCHAR(64) NULL,
      config_disk VARCHAR(255) NULL,
      original_value DECIMAL(10,2) NULL,
      condition_score TINYINT NULL DEFAULT 10,
      remark TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_emp (employee_id),
      INDEX idx_status (status),
      INDEX idx_hostname (hostname)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  const [assetCols] = await pool.query<any[]>(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='assets'`)
  const assetNames = new Set(assetCols.map((x: any) => x.COLUMN_NAME))
  if (!assetNames.has('config_cpu')) await pool.query('ALTER TABLE assets ADD COLUMN config_cpu VARCHAR(255) NULL')
  if (!assetNames.has('config_memory')) await pool.query('ALTER TABLE assets ADD COLUMN config_memory VARCHAR(64) NULL')
  if (!assetNames.has('config_disk')) await pool.query('ALTER TABLE assets ADD COLUMN config_disk VARCHAR(255) NULL')
  if (!assetNames.has('condition_score')) await pool.query('ALTER TABLE assets ADD COLUMN condition_score TINYINT NULL DEFAULT 10')
  await pool.query('UPDATE assets SET condition_score = 10 WHERE condition_score IS NULL')

  // 设备清单（组件子表）：组件需要行级编辑和按类型统计，
  // 所以用独立子表而不是 JSON 字段（JSON 适合"只读快照"，不适合结构化业务数据）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asset_components (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asset_id INT NOT NULL,
      comp_type VARCHAR(16) NOT NULL,
      brand_model VARCHAR(128) NOT NULL DEFAULT '',
      sn VARCHAR(64) NOT NULL DEFAULT '',
      spec VARCHAR(255) NOT NULL DEFAULT '',
      quantity INT NOT NULL DEFAULT 1,
      source ENUM('auto','manual') NOT NULL DEFAULT 'manual',
      remark VARCHAR(255) NOT NULL DEFAULT '',
      INDEX idx_asset (asset_id),
      INDEX idx_type (comp_type),
      CONSTRAINT fk_comp_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  const [componentCols] = await pool.query<any[]>(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='asset_components'`)
  if (!new Set(componentCols.map((x: any) => x.COLUMN_NAME)).has('sn')) {
    await pool.query("ALTER TABLE asset_components ADD COLUMN sn VARCHAR(64) NOT NULL DEFAULT '' AFTER brand_model")
  }

  // 审计日志：对应"审计上报"——直接写服务端库，天然就是"上报"
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action VARCHAR(64), detail TEXT, at VARCHAR(32)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

/** 种子数据：公司根节点 + 两级示例部门树（幂等：已有部门则跳过） */
async function seedDepartments(): Promise<void> {
  const pool = getPool()
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM departments')
  if ((rows as { n: number }[])[0].n > 0) return

  const [r] = await pool.query(
    'INSERT INTO departments (name, parent_id, remark, sort) VALUES (?, NULL, ?, 0)',
    ['某某科技有限公司', '公司根节点']
  )
  const rootId = (r as { insertId: number }).insertId
  const depts: [string, number, number][] = [
    ['研发中心', rootId, 1],
    ['产品部', rootId, 2],
    ['人事行政部', rootId, 3]
  ]
  for (const [name, pid, sort] of depts) {
    const [d] = await pool.query(
      'INSERT INTO departments (name, parent_id, sort) VALUES (?, ?, ?)',
      [name, pid, sort]
    )
    const deptId = (d as { insertId: number }).insertId
    if (name === '研发中心') {
      const groups = ['前端组', '后端组', '测试组']
      for (let i = 0; i < groups.length; i++) {
        await pool.query(
          'INSERT INTO departments (name, parent_id, sort) VALUES (?, ?, ?)',
          [groups[i], deptId, i + 1]
        )
      }
    }
  }
  console.log('[db] 部门种子数据已插入')
}

export async function ensureSchema(): Promise<void> {
  await migrateLegacyCollectTable()
  await createTables()
  await seedDepartments()
}
