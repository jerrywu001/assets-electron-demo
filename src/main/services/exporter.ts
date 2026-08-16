// ==================== Excel 导出（exceljs，纯 JS 无原生依赖）====================
import ExcelJS from 'exceljs';
import { CATEGORY_LABELS, COMP_TYPE_LABELS, STATUS_LABELS } from '../../shared/depreciation';
import type { Asset, AssetComponent, CollectRecord, DiskInfo, NicInfo } from '../../shared/types';

/** 采集记录导出（本机采集页沿用） */
export async function exportCollectRecords(records: CollectRecord[], filePath: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('采集记录');

  ws.columns = [
    {
      header: 'ID',
      key: 'id',
      width: 6, 
    },
    {
      header: '主机名',
      key: 'hostname',
      width: 20, 
    },
    {
      header: 'MAC 地址',
      key: 'mac',
      width: 18, 
    },
    {
      header: '操作系统',
      key: 'os',
      width: 26, 
    },
    {
      header: 'CPU',
      key: 'cpu',
      width: 40, 
    },
    {
      header: '核数',
      key: 'cores',
      width: 8, 
    },
    {
      header: '内存(MB)',
      key: 'mem',
      width: 12, 
    },
    {
      header: '磁盘',
      key: 'disks',
      width: 32, 
    },
    {
      header: '网卡/IP/MAC',
      key: 'nics',
      width: 46, 
    },
    {
      header: '采集时间',
      key: 'at',
      width: 22, 
    },
  ];
  ws.getRow(1).font = { bold: true };

  for (const a of records) {
    const disks = (JSON.parse(a.disks_json || '[]') as DiskInfo[])
      .map((d) => `${d.sizeGB}GB`).join('; ');
    const nics = (JSON.parse(a.nics_json || '[]') as NicInfo[])
      .map((n) => `${n.name} ${n.ip} ${n.mac}`).join('; ');

    ws.addRow({
      id: a.id,
      hostname: a.hostname,
      mac: a.mac ?? '',
      os: a.os,
      cpu: a.cpu,
      cores: a.cpu_cores,
      mem: a.mem_total_mb,
      disks,
      nics,
      at: a.collected_at,
    });
  }

  await wb.xlsx.writeFile(filePath);
  return filePath;
}

/** 台账导出：双 sheet（台账 + 组件明细），内容与当前筛选一致 */
export async function exportLedger(
  assets: Asset[],
  components: AssetComponent[],
  filePath: string,
): Promise<string> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1：台账（净值是导出时刻现算的值）
  const ws = wb.addWorksheet('资产台账');

  ws.columns = [
    {
      header: '资产编号',
      key: 'no',
      width: 18, 
    },
    {
      header: '分类',
      key: 'cat',
      width: 10, 
    },
    {
      header: '归属员工',
      key: 'emp',
      width: 12, 
    },
    {
      header: '部门',
      key: 'dept',
      width: 20, 
    },
    {
      header: '状态',
      key: 'status',
      width: 10, 
    },
    {
      header: '存放位置',
      key: 'loc',
      width: 14, 
    },
    {
      header: '原值(元)',
      key: 'ov',
      width: 12, 
    },
    {
      header: '成色',
      key: 'condition',
      width: 8, 
    },
    {
      header: '当前净值(元)',
      key: 'nv',
      width: 14, 
    },
    {
      header: '更新时间',
      key: 'ut',
      width: 20, 
    },
  ];
  ws.getRow(1).font = { bold: true };
  for (const a of assets) {
    ws.addRow({
      no: a.asset_no,
      cat: CATEGORY_LABELS[a.category] ?? a.category,
      emp: a.emp_name ?? '',
      dept: a.dept_path ?? '',
      status: STATUS_LABELS[a.status] ?? a.status,
      loc: a.location ?? '',
      ov: a.original_value ?? '',
      condition: a.condition_score ?? '',
      nv: a.net_value ?? '',
      ut: a.updated_at,
    });
  }

  // Sheet 2：组件明细（平铺，财务/盘点可透视）
  const ws2 = wb.addWorksheet('组件明细');

  ws2.columns = [
    {
      header: '资产编号',
      key: 'no',
      width: 18, 
    },
    {
      header: '设备类型',
      key: 'type',
      width: 12, 
    },
    {
      header: '品牌型号',
      key: 'model',
      width: 30, 
    },
    {
      header: '序列号SN',
      key: 'sn',
      width: 18, 
    },
    {
      header: '规格参数',
      key: 'spec',
      width: 30, 
    },
    {
      header: '数量',
      key: 'qty',
      width: 8, 
    },
    {
      header: '来源',
      key: 'src',
      width: 8, 
    },
    {
      header: '备注',
      key: 'remark',
      width: 20, 
    },
  ];
  ws2.getRow(1).font = { bold: true };
  const assetNoOf = new Map(assets.map((a) => [a.id, a.asset_no]));

  for (const c of components) {
    ws2.addRow({
      no: assetNoOf.get(c.asset_id ?? 0) ?? '',
      type: COMP_TYPE_LABELS[c.comp_type] ?? c.comp_type,
      model: c.brand_model,
      sn: c.sn ?? '',
      spec: c.spec,
      qty: c.quantity,
      src: c.source === 'auto' ? '自动' : '手工',
      remark: c.remark,
    });
  }

  await wb.xlsx.writeFile(filePath);
  return filePath;
}
