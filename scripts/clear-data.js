// 数据清理脚本：清空资产/设备/审计数据，保留部门组织架构和员工信息
// 用法：npm run clean
// 配置读取项目根目录 db.config.json（与客户端同一份）
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

// 保留 departments / employees，其余业务表全部清空
const CLEAR_TABLES = ['asset_components', 'assets', 'audits', 'collect_records']
const KEEP_TABLES = ['departments', 'employees']

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db.config.json'), 'utf-8'))
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    database: cfg.database
  })

  // 只处理真实存在的表（新表还没建时不报错，脚本可长期复用）
  const [rows] = await conn.query(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?`,
    [cfg.database]
  )
  const existing = new Set(rows.map((r) => r.t))
  console.log(`数据库 ${cfg.database} 现有表: ${[...existing].join(', ') || '(空)'}`)

  for (const t of KEEP_TABLES) {
    if (existing.has(t)) {
      const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``)
      console.log(`✅ 保留 ${t}（${c[0].n} 行）`)
    } else {
      console.log(`✅ 保留 ${t}（表不存在，跳过）`)
    }
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 0')
  for (const t of CLEAR_TABLES) {
    if (existing.has(t)) {
      const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``)
      await conn.query(`TRUNCATE TABLE \`${t}\``)
      console.log(`🗑️  已清空 ${t}（原 ${c[0].n} 行）`)
    } else {
      console.log(`⏭️  跳过 ${t}（表不存在）`)
    }
  }
  // 演示数据会重建自定义分类和设备类型；保留系统预置项，清除历史测试项及其关联。
  if (existing.has('category_device_types')) {
    await conn.query('TRUNCATE TABLE `category_device_types`')
    console.log('🗑️  已清空 category_device_types')
  }
  if (existing.has('asset_categories')) {
    await conn.query('DELETE FROM `asset_categories` WHERE is_preset = FALSE')
    console.log('🗑️  已清理自定义资产分类')
  }
  if (existing.has('device_types')) {
    await conn.query('DELETE FROM `device_types` WHERE is_preset = FALSE')
    console.log('🗑️  已清理自定义设备类型')
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1')

  await conn.end()
  console.log('完成。')
}

main().catch((e) => { console.error('清理失败:', e.message); process.exit(1) })
