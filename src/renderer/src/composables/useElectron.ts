// ==================== Electron 能力封装（composable）====================
// 面试要点：Vue 组件不直接碰 window.electronAPI，
// 统一走 composable——类型来自 shared 契约层，组件里写法保持"Vue 味"。
//
// 踩坑记录（真实 bug）：页面把 reactive() 的 query/form 直接传给 IPC，
// Proxy 在 contextBridge 边界做结构化克隆时抛 "An object could not be cloned"。
// 净化必须发生在页面主世界（进桥之前），所以在这里统一包装：
// 所有方法参数先 JSON 深拷贝为纯对象再发。
import type { AssetApi } from '../../../shared/ipc';

/** 剥掉 Vue 响应式代理，得到可结构化克隆的纯对象 */
function plain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

let cached: AssetApi | null = null;

export function useElectron(): AssetApi {
  if (!window.electronAPI) {
    // preload 没生效（比如在纯浏览器里打开了页面）时给明确报错
    throw new Error('electronAPI 未注入：请通过 Electron 客户端访问');
  }
  if (cached) return cached;

  const raw = window.electronAPI as unknown as Record<string, unknown>;
  const wrapped: Record<string, unknown> = {};

  for (const [key, fn] of Object.entries(raw)) {
    if (typeof fn !== 'function' || key === 'onAuditNotice') {
      // onAuditNotice 的参数是回调函数，不能 JSON 化，原样透传
      wrapped[key] = fn;
      continue;
    }
    wrapped[key] = (...args: unknown[]) =>
      (fn as (...a: unknown[]) => unknown)(...args.map(plain));
  }
  cached = wrapped as unknown as AssetApi;
  return cached;
}
