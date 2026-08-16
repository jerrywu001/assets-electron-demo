// ==================== 渲染层小工具 ====================

/** IPC 抛错时 Electron 会包一层 "Error invoking remote method ..."，剥掉它拿原始业务错误信息 */
export function errMsg(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e);

  return s.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

export function fmtMoney(v: number | null | undefined): string {
  if (v == null) return '-';
  return `¥${v.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2, 
  })}`;
}
