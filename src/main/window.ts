// ==================== 窗口创建 + 安全管控 ====================
import { BrowserWindow, Menu } from 'electron';
import path from 'path';
import { IpcChannel } from '../shared/ipc';
import { insertAudit } from './db';

export function createWindow(openDevTools: boolean): BrowserWindow {
  // 无边框窗口：标题栏由渲染层自绘（图标/菜单/窗口控制一体化），
  // 原生 File/Edit/View 菜单没有存在必要，直接移除
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1360,
    height: 840,
    frame: false,
    minWidth: 1080,
    minHeight: 680,
    webPreferences: {
      // electron-vite 把 preload 打成单文件 CJS（沙箱兼容）
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, // 隔离 preload 与网页的 JS 世界
      nodeIntegration: false, // 网页不能直接用 Node
      sandbox: true, // 渲染进程关进 Chromium 沙箱
    },
  });

  // 开发模式加载 Vite dev server（HMR 热更新），生产模式加载打包产物
  // ELECTRON_RENDERER_URL 由 electron-vite dev 自动注入
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // ---- 安全管控（对应 JD 职责第 2 条：策略必须在主进程做，网页层管控都能被绕过）----
  // 打印管控：拦截 Ctrl+P / Ctrl+Shift+P
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.control && input.key.toLowerCase() === 'p') {
      event.preventDefault();
      // 事件回调是同步的，审计写库异步执行（fire-and-forget，失败只打日志不阻塞拦截）
      void insertAudit('print-blocked', '用户尝试打印，已被安全策略拦截').catch(console.error);
      win.webContents.send(IpcChannel.AuditNotice, '⚠️ 打印功能已被安全策略禁止，本次操作已记录');
    }
  });
  // 下载管控：所有下载直接取消（真实项目按白名单策略放行）
  win.webContents.session.on('will-download', (_event, item) => {
    void insertAudit('download-blocked', `拦截下载: ${item.getFilename()}`).catch(console.error);
    item.cancel();
    win.webContents.send(IpcChannel.AuditNotice, '⚠️ 下载已被安全策略禁止，本次操作已记录');
  });

  if (openDevTools) win.webContents.openDevTools();
  return win;
}
