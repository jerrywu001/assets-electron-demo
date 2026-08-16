// ==================== 数据库连接层（MySQL 连接池）====================
// 选型理由（面试可讲）：
// - 资产数据要【集中汇总】多台机器，所以用服务端 MySQL 而不是单机 SQLite
// - 驱动用 mysql2：纯 JS 实现、无原生编译、支持 Promise 和连接池
// - 连接配置放在 db.config.json（不入库 git，真实项目走环境变量或配置中心）
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { app } from 'electron';
import mysql, { type Pool } from 'mysql2/promise';

interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

let pool: Pool;

function getConfigCandidates(): string[] {
  const configured = process.env['ASSET_DB_CONFIG'];

  if (configured) return [path.resolve(configured)];

  if (app.isPackaged) {
    // Packaged apps cannot read user-created files from inside app.asar.
    return [path.join(app.getPath('userData'), 'db.config.json')];
  }

  return [
    path.join(process.cwd(), 'db.config.json'),
    path.join(app.getAppPath(), 'db.config.json'),
  ];
}

function loadConfig(): DbConfig {
  const candidates = getConfigCandidates();
  const file = candidates.find((candidate) => existsSync(candidate));

  if (!file) {
    throw new Error(
      `找不到数据库配置文件，请创建 ${candidates[0]}，或设置 ASSET_DB_CONFIG 环境变量`,
    );
  }

  return JSON.parse(readFileSync(file, 'utf-8')) as DbConfig;
}

export async function connect(): Promise<void> {
  const cfg = loadConfig();

  // 先不指定数据库连上去，确保库存在（IF NOT EXISTS 幂等，重复启动安全）
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
  });

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` DEFAULT CHARSET utf8mb4`,
  );
  await conn.end();

  // 连接池：客户端常驻复用连接。
  // dateStrings: true —— DATE/DATETIME 一律按 'YYYY-MM-DD[ HH:mm:ss]' 字符串返回，
  // 避免 mysql2 默认转 JS Date 带来的时区偏移和 IPC 序列化歧义。
  pool = mysql.createPool({
    ...cfg,
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true,
  });
}

export function getPool(): Pool {
  if (!pool) throw new Error('数据库未初始化：请先调用 connect()');
  return pool;
}
