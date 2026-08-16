// ==================== IPC 注册公共包装 ====================
// invoke/handle 是"请求-响应"式，渲染端 await 一个 Promise，像调 HTTP 接口。
// 真实项目还会在这里做参数校验和权限判断——渲染进程可能被 XSS 控制，
// 主进程不能信任 IPC 传进来的任何数据。
import { ipcMain } from 'electron';

/** 类型化的 handle 包装：让注册函数的签名和契约对齐 */
export function handle<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (...args: TArgs) => Promise<TResult> | TResult,
): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    const started = Date.now();
    const summary = args.length ? args.map((arg) => summarize(arg)).join(', ') : '-';

    console.log(`[ipc] -> ${channel} args=${summary}`);
    try {
      const result = await fn(...(args as TArgs));

      console.log(`[ipc] <- ${channel} ok ${Date.now() - started}ms`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`[ipc] <- ${channel} error ${Date.now() - started}ms: ${message}`);
      throw error;
    }
  });
}

function summarize(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[array:${value.length}]`;
  const keys = Object.keys(value as Record<string, unknown>);

  return `{${keys.join(',')}}`;
}
