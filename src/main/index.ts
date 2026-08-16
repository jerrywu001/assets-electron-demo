// ==================== 主进程入口 ====================
import path from 'path';
import { app, BrowserWindow } from 'electron';
import { initDb, getPool } from './db';
import { getDeptTree, createDept, deleteDept } from './db/department';
import { createEmployee, previewEmpLeft, markEmpLeft } from './db/employee';
import { createAsset, getAsset, matchAndUpdateAsset, assetStats } from './db/asset';
import { insertCollectRecord, listCollectRecords } from './db/collect';
import { insertAudit } from './db/audit';
import { registerIpc } from './ipc';
import { createWindow } from './window';
import { collectAssetInfo } from './services/collector';
import { exportLedger } from './services/exporter';
import type { RowDataPacket } from 'mysql2/promise';

const isSmoke = process.argv.includes('--smoke');
const isIpcTest = process.argv.includes('--ipc-test');
const isShot = process.argv.includes('--shot');
const openDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === 'true';

// ============ UI 截图模式：隐藏窗口加载真实界面，抓图后退出（文档/自检用） ============
async function runShot(): Promise<void> {
  registerIpc();
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  const page = process.argv.find((a) => a.startsWith('--page='))?.slice(7) ?? 'dashboard';
  const hash = `/${page}`;

  if (process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#' + hash);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash });
  }
  // 截图共用同一 userData profile，主题/侧栏状态会残留——先写 localStorage 再刷新，保证可复现
  const dark = process.argv.includes('--dark');
  const collapse = process.argv.includes('--collapsed');

  await win.webContents.executeJavaScript(`
    localStorage.setItem('app-theme', ${JSON.stringify(dark ? 'dark' : 'light')});
    localStorage.setItem('sidebar-collapsed', ${JSON.stringify(collapse ? '1' : '0')});
  `);
  win.webContents.reload();
  await new Promise((r) => setTimeout(r, 3500)); // 等重新加载、数据请求与渲染稳定
  // 可选：--eval='JS表达式' 在页面里执行并打印结果（调试用）
  const evalExpr = process.argv.find((a) => a.startsWith('--eval='))?.slice(7);

  if (evalExpr) {
    const result = await win.webContents.executeJavaScript(evalExpr);

    console.log('[shot:eval]', JSON.stringify(result));
  }
  const img = await win.webContents.capturePage();
  const file = path.join(app.getPath('userData'), `ui-shot-${page}${dark ? '-dark' : ''}.png`);
  const { writeFileSync } = await import('fs');

  writeFileSync(file, img.toPNG());
  console.log('[shot] 已保存:', file);
  win.destroy();
  app.exit(0);
}

// ============ IPC 端到端测试：隐藏窗口 + 真实 preload，验证全链路可克隆 ============
// 页面里故意用 Proxy 包装参数（模拟 Vue reactive），覆盖"Proxy 无法结构化克隆"的坑。
async function runIpcTest(): Promise<void> {
  const { writeFileSync } = await import('fs');
  const { tmpdir } = await import('os');

  registerIpc();
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  const done = new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      console.error('[ipc-test] ❌ 超时'); resolve(false); 
    }, 25000);

    win.webContents.on('console-message', (...args: unknown[]) => {
      // Electron 37 新事件签名是 (event)，旧签名是 (level, message, ...)，两种都兼容
      const msg = typeof args[0] === 'object' && args[0] !== null && 'message' in args[0]
        ? String((args[0] as { message: unknown }).message)
        : String(args[1]);

      console.log('[ipc-test]', msg);
      if (msg.includes('ALL-DONE')) {
        clearTimeout(timer); resolve(true); 
      }
      if (msg.includes('FAIL')) {
        clearTimeout(timer); resolve(false); 
      }
    });
  });
  const html = `<!doctype html><meta charset="utf-8"><script>
    const raw = window.electronAPI
    const log = (m) => console.log(m)
    // 与 renderer/composables/useElectron.ts 一致的包装：参数先净化为纯对象
    const plain = (v) => (v === null || typeof v !== 'object') ? v : JSON.parse(JSON.stringify(v))
    const api = {}
    for (const [k, fn] of Object.entries(raw)) {
      api[k] = (typeof fn !== 'function' || k === 'onAuditNotice')
        ? fn
        : (...args) => fn(...args.map(plain))
    }
    // 模拟 Vue reactive()：Proxy 对象
    const rx = (o) => new Proxy(o, {})
    ;(async () => {
      // 1) 先验证诊断：未净化的 Proxy 参数必须抛 "could not be cloned"
      try {
        await raw.listAssets(rx({ page: 1, pageSize: 10 }))
        log('FAIL 裸 Proxy 参数竟然通过了，诊断不成立')
        return
      } catch (e) {
        if (!/could not be cloned/.test(e.message)) { log('FAIL 意外错误: ' + e.message); return }
        log('诊断确认: 裸 Proxy 参数被 contextBridge 拒绝（could not be cloned）')
      }
      // 2) 走净化包装（同 useElectron），全链路必须通
      try {
        const tree = await api.getDeptTree(); log('getDeptTree OK ' + tree.length)
        const emps = await api.listEmployees(rx({ keyword: '', status: '', page: 1, pageSize: 10 })); log('listEmployees OK ' + emps.total)
        const assets = await api.listAssets(rx({ category: '', status: '', keyword: '', page: 1, pageSize: 10 }))
        log('listAssets OK total=' + assets.total)
        const stats = await api.assetStats(); log('assetStats OK total=' + stats.total)
        const devices = await api.listDevices(rx({ compType: '', source: '', keyword: '', page: 1, pageSize: 10 }))
        log('listDevices OK total=' + devices.total)
        const audits = await api.listAudits(10); log('listAudits OK ' + audits.length)
        const records = await api.listCollectRecords(); log('listCollectRecords OK ' + records.length)
        const no = await api.nextAssetNo('PC'); log('nextAssetNo OK ' + no)
        if (assets.rows[0]) {
          const d = await api.getAsset(assets.rows[0].id); log('getAsset OK comps=' + d.components.length)
          const empsOfDept = await api.listDeptEmployees(tree[0].id); log('listDeptEmployees OK ' + empsOfDept.length)
        }
        log('ALL-DONE')
      } catch (e) { log('FAIL ' + e.message) }
    })()
  <\/script>`;
  const file = path.join(tmpdir(), 'ipc-test.html');

  writeFileSync(file, html);
  await win.loadFile(file);
  const ok = await done;

  win.destroy();
  app.exit(ok ? 0 : 1);
}

// ============ 冒烟测试模式：不开窗口，跑全流程后退出 ============
// 每个里程碑追加断言，保持"一条命令验证全系统"的传统。
async function runSmoke(): Promise<void> {
  const pool = getPool();

  // ---- M1：新表存在性 + 部门树种子 ----
  console.log('[smoke] 1. 检查数据表...');
  const [tables] = await pool.query<RowDataPacket[]>(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
  );
  const names = new Set((tables as { TABLE_NAME: string }[]).map((t) => t.TABLE_NAME));

  for (const t of ['departments', 'employees', 'assets', 'asset_components', 'collect_records', 'audits']) {
    if (!names.has(t)) throw new Error(`缺少数据表: ${t}`);
  }
  console.log('[smoke]    6 张表全部存在 ✓');

  const tree = await getDeptTree();

  if (tree.length === 0 || tree[0].children.length < 3) throw new Error('部门种子数据缺失');
  console.log(`[smoke]    部门树种子: ${tree[0].name}，一级部门 ${tree[0].children.length} 个 ✓`);

  // 部门删除保护（R7）：根节点有子部门，删除必须被拒
  let protectedOk = false;

  try {
    await deleteDept(tree[0].id);
  } catch {
    protectedOk = true;
  }
  if (!protectedOk) throw new Error('部门删除保护失效：有子部门的节点被删掉了');
  console.log('[smoke]    部门删除保护（R7）✓');

  // ---- M2：员工 + 完整资产登记往返 ----
  console.log('[smoke] 2. 员工 + 资产登记往返...');
  const leaf = tree[0].children[0].children[0] ?? tree[0].children[0];
  const empNo = `SMOKE${Date.now() % 100000}`;
  const empId = await createEmployee({
    emp_no: empNo,
    name: '冒烟测试员',
    dept_id: leaf.id, 
  });
  const assetId = await createAsset({
    category: 'PC',
    brand_model: 'SmokeTest PC',
    employee_id: empId,
    status: 'inuse',
    original_value: 8000,
    condition_score: 8,
    components: [
      {
        comp_type: 'monitor',
        brand_model: 'Dell U2720D',
        spec: '27寸 4K',
        quantity: 2,
        source: 'manual',
        remark: '', 
      },
      {
        comp_type: 'kbmouse',
        brand_model: 'Logitech MK470',
        spec: '',
        quantity: 1,
        source: 'manual',
        remark: '', 
      },
    ],
  });
  const detail = await getAsset(assetId);

  if (detail.components.length !== 2) throw new Error('组件清单写入不完整');
  if (!/^IT-PC-\d{4}-\d{4}$/.test(detail.asset.asset_no)) throw new Error(`编号规则异常: ${detail.asset.asset_no}`);
  if (detail.asset.net_value !== 6400) {
    throw new Error(`净值计算异常: ${detail.asset.net_value}`);
  }
  console.log(`[smoke]    登记 ${detail.asset.asset_no}，组件 4 行，净值 ¥${detail.asset.net_value} ✓`);

  // ---- M4：采集联动（按 hostname 匹配，刷新 auto 行）----
  console.log('[smoke] 3. 采集联动...');
  const info = await collectAssetInfo();

  await insertCollectRecord(info);
  // 把刚登记的资产绑定到本机 hostname，再触发匹配
  await pool.query('UPDATE assets SET hostname = ? WHERE id = ?', [info.hostname, assetId]);
  const matched = await matchAndUpdateAsset(info);

  if (matched !== detail.asset.asset_no) throw new Error('采集联动未匹配到资产');
  const after = await getAsset(assetId);
  const autoRows = after.components.filter((c) => c.source === 'auto');
  const manualRows = after.components.filter((c) => c.source === 'manual');

  if (autoRows.length !== 0) throw new Error('不应自动回填组件行');
  if (manualRows.length !== 2) throw new Error('手工组件行被误删');
  console.log(`[smoke]    命中 ${matched}，auto 行 ${autoRows.length} 条已刷新，手工行保留 ✓`);

  // ---- 离职回收闭环 ----
  const inuse = await previewEmpLeft(empId);

  if (inuse.length !== 1) throw new Error('离职预检未列出在用资产');
  const affected = await markEmpLeft(empId, '2026-08-15');

  if (affected !== 1) throw new Error('离职回收联动失败');
  console.log('[smoke]    离职 → 资产转待回收 ✓');

  // ---- M3：台账导出（双 sheet）----
  console.log('[smoke] 4. 导出台账（双 sheet）...');
  const { listAssetsWithComponents } = await import('./db/asset');
  const { assets, components } = await listAssetsWithComponents({
    page: 1,
    pageSize: 100, 
  });
  const file = await exportLedger(
    assets, components, path.join(app.getPath('userData'), `资产台账-smoke-${Date.now()}.xlsx`),
  );

  console.log(`[smoke]    导出成功: ${file}（资产 ${assets.length} 条 / 组件 ${components.length} 行）✓`);

  const stats = await assetStats();

  console.log(`[smoke] 5. 统计: 总数=${stats.total} 在用=${stats.inuse} 待回收=${stats.pendingRecycle} 账面净值=¥${stats.totalNetValue}`);

  // 清理冒烟产生的演示数据，保持库干净
  await pool.query('DELETE FROM assets WHERE id = ?', [assetId]);
  await pool.query('DELETE FROM employees WHERE id = ?', [empId]);
  await insertAudit('smoke-test', '冒烟测试通过');
  console.log('[smoke] ✅ 全流程通过');
}

app.whenReady().then(async () => {
  try {
    await initDb();
  } catch (e) {
    // 数据库连不上（没启动/密码错）时给出明确提示再退出
    console.error('数据库初始化失败，请检查 db.config.json 和 MySQL 服务：', e);
    app.exit(1);
    return;
  }
  if (isSmoke) {
    try {
      await runSmoke();
    } catch (e) {
      console.error('[smoke] ❌', e);
      app.exit(1);
      return;
    }
    app.exit(0);
    return;
  }
  if (isIpcTest) {
    await runIpcTest();
    return;
  }
  if (isShot) {
    try {
      await runShot();
    } catch (e) {
      console.error('[shot] ❌', e);
      app.exit(1);
    }
    return;
  }
  registerIpc();
  createWindow(openDevTools);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(openDevTools);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
