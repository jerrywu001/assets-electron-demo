// ==================== IPC：无边框窗口控制 ====================
// 自定义标题栏的最小化/最大化/关闭按钮，通过事件源找到对应窗口操作。
import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel, type WindowAction } from '../../shared/ipc'

export function registerWindowIpc(): void {
  ipcMain.handle(IpcChannel.WindowControl, (event, action: WindowAction) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (action === 'minimize') win.minimize()
    else if (action === 'maximize') {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    } else if (action === 'close') win.close()
  })
}
