import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(readFileSync(path.join(root, 'db.config.json'), 'utf-8'))
const pool = mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 3, dateStrings: true })

const categories = [
  ['PC', '办公电脑'], ['SRV', '服务器'], ['OTH', '其他'], ['NET', '网络设备'],
  ['PRINT', '打印设备'], ['MOB', '移动设备'], ['AV', '音视频设备'], ['FURN', '办公家具']
]
const deviceTypes = [
  ['host', '主机'], ['laptop', '笔记本'], ['monitor', '显示器'], ['psu', '电源'],
  ['kbmouse', '键盘鼠标'], ['router', '路由器'], ['switch', '交换机'], ['printer', '打印机'],
  ['phone', '手机'], ['tablet', '平板电脑'], ['projector', '投影仪'], ['chair', '办公椅'], ['other', '其他']
]
const links = {
  PC: ['host', 'laptop', 'monitor', 'psu', 'kbmouse'],
  SRV: ['host', 'other'], OTH: ['other'], NET: ['router', 'switch', 'other'],
  PRINT: ['printer', 'other'], MOB: ['phone', 'tablet'], AV: ['projector', 'other'], FURN: ['chair', 'other']
}
const models = [
  ['PC', '联想 ThinkCentre M760', 6800], ['PC', 'Dell OptiPlex 7010', 7200],
  ['PC', 'HP ProDesk 480 G9', 6100], ['SRV', 'Dell PowerEdge R750', 46000],
  ['SRV', 'HPE ProLiant DL380', 52000], ['NET', '华为 AR6120 路由器', 8900],
  ['NET', 'H3C S5130S 交换机', 12600], ['PRINT', '惠普 LaserJet M607', 7600],
  ['PRINT', '佳能 imageRUNNER C3226', 14800], ['MOB', 'iPhone 15 Pro', 8999],
  ['MOB', '华为 MatePad Pro', 4999], ['AV', '爱普生 EB-992F 投影仪', 6800],
  ['FURN', '办公椅 人体工学款', 1800], ['OTH', '会议室白板', 1200]
]

async function ensureLookups() {
  for (const [value, name] of categories) {
    await pool.query('INSERT INTO asset_categories (value, name, is_preset) VALUES (?, ?, FALSE) ON DUPLICATE KEY UPDATE name = VALUES(name)', [value, name])
  }
  for (const [value, name] of deviceTypes) {
    await pool.query('INSERT INTO device_types (value, name, is_preset) VALUES (?, ?, FALSE) ON DUPLICATE KEY UPDATE name = VALUES(name)', [value, name])
  }
  for (const [categoryValue, typeValues] of Object.entries(links)) {
    const [[category]] = await pool.query('SELECT id FROM asset_categories WHERE value = ?', [categoryValue])
    for (const typeValue of typeValues) {
      const [[type]] = await pool.query('SELECT id FROM device_types WHERE value = ?', [typeValue])
      await pool.query('INSERT IGNORE INTO category_device_types (category_id, device_type_id) VALUES (?, ?)', [category.id, type.id])
    }
  }
}

async function ensureEmployees() {
  const [[countRow]] = await pool.query('SELECT COUNT(*) AS n FROM employees')
  let count = Number(countRow.n)
  const [deptRows] = await pool.query(`SELECT d.id FROM departments d
    WHERE d.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM departments c WHERE c.parent_id = d.id)
    ORDER BY d.id`)
  if (!deptRows.length) throw new Error('没有可用的下级部门，无法生成员工演示数据')
  const names = ['高宇','林晓','陈思远','周倩','何俊','宋佳','许晨','唐悦','蒋帆','韩雪','邓凯','罗欣','彭博','沈怡','方圆','顾晨','梁栋','苏妍','杜鹏','魏然','蒋楠','叶青','秦川','袁媛','谢峰','潘婷','石磊','贺敏','程浩','白璐','江涛','夏琳','钟诚','孟瑶','许航','沈琳','傅明','陆瑶','邱泽','姜宁']
  for (let i = count; i < 50; i += 1) {
    const no = `DEMO-E${String(i + 1).padStart(3, '0')}`
    const dept = deptRows[i % deptRows.length]
    await pool.query(
      `INSERT IGNORE INTO employees (emp_no, name, dept_id, position, hire_date, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [no, names[i % names.length], dept.id, i % 3 === 0 ? '研发工程师' : i % 3 === 1 ? '测试工程师' : '产品专员', '2024-01-15']
    )
  }
  const [demoRows] = await pool.query('SELECT id FROM employees WHERE emp_no LIKE \'DEMO-E%\' ORDER BY id')
  for (let i = 0; i < demoRows.length; i += 1) {
    await pool.query('UPDATE employees SET name = ?, dept_id = ? WHERE id = ?', [names[i % names.length], deptRows[i % deptRows.length].id, demoRows[i].id])
  }
}

async function seedAssets() {
  const [[countRow]] = await pool.query('SELECT COUNT(*) AS n FROM assets')
  let count = Number(countRow.n)
  if (count >= 30) return 0
  const [[yearRow]] = await pool.query('SELECT YEAR(CURDATE()) AS year')
  const year = yearRow.year
  const [[seqRow]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS n FROM assets')
  const [[employee]] = await pool.query("SELECT id FROM employees WHERE status = 'active' ORDER BY id LIMIT 1")
  const employees = (await pool.query("SELECT id FROM employees WHERE status = 'active' ORDER BY id"))[0]
  let created = 0
  for (let i = count; i < 30; i += 1) {
    const [category, baseModel, value] = models[i % models.length]
    const model = `${baseModel} 演示-${String(i + 1).padStart(2, '0')}`
    const number = Number(seqRow.n) + created + 1
    const assetNo = `DEMO-${category}-${year}-${String(number).padStart(4, '0')}`
    const assigned = i % 6 !== 5 && employees.length > 0
    const employeeId = assigned ? employees[i % employees.length].id : null
    const status = assigned ? (i % 7 === 0 ? 'repair' : 'inuse') : 'idle'
    const mac = category === 'PC' ? `02:DE:MO:${String(i).padStart(2, '0')}:00:01` : null
    const config = category === 'PC' ? ['Intel Core i5-12400（6 核）', '16 GB', '512 GB NVMe'] : [null, null, null]
    const [result] = await pool.query(
      `INSERT INTO assets
       (asset_no, category, brand_model, sn, employee_id, status, location, hostname, mac, config_cpu, config_memory, config_disk, original_value, condition_score, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetNo, category, model, `DEMO-SN-${String(number).padStart(5, '0')}`, employeeId, status,
        `${1 + (i % 6)}F-${String.fromCharCode(65 + (i % 4))}${String(10 + i).padStart(2, '0')}`,
        category === 'PC' ? `DEMO-PC-${String(i + 1).padStart(2, '0')}` : null, mac, ...config,
        value, 5 + (i % 6), '丰富演示数据']
    )
    const type = links[category][0]
    await pool.query(
      `INSERT INTO asset_components (asset_id, comp_type, brand_model, sn, spec, quantity, source, remark)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', '演示设备')`,
      [result.insertId, type, model, `COMP-${String(number).padStart(5, '0')}`, category === 'PC' ? '标准配置' : '常规规格', 1]
    )
    await pool.query(
      'INSERT INTO audits (action, detail, at) VALUES (?, ?, ?)',
      ['asset-create', `登记资产: ${assetNo} ${model}，组件 1 行`, new Date()]
    )
    created += 1
  }
  return created
}

await ensureLookups()
await ensureEmployees()
const created = await seedAssets()
await pool.query('INSERT INTO audits (action, detail, at) VALUES (?, ?, ?)', ['seed-rich', `补充丰富演示数据 ${created} 条资产、员工补足至至少 50 人`, new Date()])
await pool.end()
console.log(`[seed-rich] 完成，新增资产 ${created} 条，员工至少 50 人，当前至少 30 条资产`)
