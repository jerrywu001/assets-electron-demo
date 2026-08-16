// ==================== 资产信息采集器 ====================
// 面试要点：这些信息只有主进程（Node 环境）拿得到，网页拿不到——
// 这正是"为什么要分主/渲染进程"的活例。
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import type { AssetInfo, DiskInfo, NicInfo } from '../../shared/types';

// 磁盘信息：Windows 上用 PowerShell 查 CIM（wmic 已弃用）
// 真实项目里更底层的采集（主板序列号、BIOS 信息）会走 N-API 原生模块调 WMI/注册表
function toDiskInfo(totalBytes: number): DiskInfo[] {
  return totalBytes > 0 ? [{ sizeGB: Math.round(totalBytes / 2 ** 30) }] : [];
}

function getWindowsDisks(): Promise<DiskInfo[]> {
  return new Promise((resolve) => {
    // 踩坑记录：子进程继承的 PATH 里可能找不到 powershell，必须用完整路径
    const ps = path.join(
      process.env.SystemRoot || 'C:\\Windows',
      'System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    );

    execFile(
      ps,
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json',
      ],
      { timeout: 8000 },
      (err, stdout) => {
        if (err || !stdout.trim()) return resolve([]);
        try {
          let data = JSON.parse(stdout);

          if (!Array.isArray(data)) data = [data];
          const totalBytes = data.reduce((sum: number, d: { Size?: number }) => sum + (Number(d.Size) || 0), 0);

          resolve(toDiskInfo(totalBytes));
        } catch {
          resolve([]);
        }
      },
    );
  });
}

function getUnixDisks(): Promise<DiskInfo[]> {
  return new Promise((resolve) => {
    const args = process.platform === 'darwin'
      ? ['-kP']
      : ['-kP', '-x', 'tmpfs', '-x', 'devtmpfs'];

    execFile('df', args, { timeout: 8000 }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve([]);
      const seen = new Set<string>();
      let totalKB = 0;

      const lines = stdout.trim().split(/\r?\n/);

      for (const line of lines.slice(1)) {
        const columns = line.trim().split(/\s+/);
        const source = columns[0];
        const sizeKB = Number(columns[1]);

        if (!source || !Number.isFinite(sizeKB) || sizeKB <= 0 || seen.has(source)) continue;
        seen.add(source);
        totalKB += sizeKB;
      }

      resolve(toDiskInfo(totalKB * 1024));
    });
  });
}

function getDisks(): Promise<DiskInfo[]> {
  return process.platform === 'win32' ? getWindowsDisks() : getUnixDisks();
}

export async function collectAssetInfo(): Promise<AssetInfo> {
  const cpus = os.cpus();
  // 网卡：只保留有 IPv4 的非内部接口（真实资产盘点要报 MAC 地址做唯一标识）
  const interfaces = Object.entries(os.networkInterfaces());
  const nics: NicInfo[] = interfaces.flatMap(([name, addrs]) =>
    (addrs || [])
      .filter((a) => a.family === 'IPv4' && !a.internal)
      .map((a) => ({
        name,
        ip: a.address,
        mac: a.mac, 
      })),
  );
  const mac = interfaces
    .flatMap(([, addrs]) => addrs || [])
    .find((a) => !a.internal && a.mac && a.mac !== '00:00:00:00:00:00')?.mac || '';

  return {
    hostname: os.hostname(),
    mac,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: cpus[0]?.model || 'unknown',
    cpuCores: cpus.length,
    memTotalMB: Math.round(os.totalmem() / 2 ** 20),
    disks: await getDisks(),
    nics,
  };
}
