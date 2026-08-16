// ==================== DB 层统一出口 ====================
// 拆分为 connection（连接池）/ schema（建表+种子）/ 各模块 DAO，
// 这里只做编排和再导出，保持旧代码 `from './db'` 的引入方式不变。
import { connect } from './connection'
import { ensureSchema } from './schema'

export async function initDb(): Promise<void> {
  await connect()
  await ensureSchema()
}

export * from './connection'
export * from './department'
export * from './employee'
export * from './asset'
export * from './device'
export * from './collect'
export * from './audit'
