// ==================== 主/渲染进程共用的类型契约 ====================
// 面试要点：把类型放在 shared 层，两端同源——改字段时两端一起报错，
// 不会出现"主进程改了返回结构，渲染端还在用旧字段"的隐性 bug。

// ---------- 采集（本机硬件信息） ----------

export interface DiskInfo {
  sizeGB: number
  /** @deprecated 仅用于兼容历史 JSON 快照 */
  drive?: string
  /** @deprecated 仅用于兼容历史 JSON 快照 */
  freeGB?: number
}

export interface NicInfo {
  name: string
  ip: string
  mac: string
}

/** 采集到的原始资产信息 */
export interface AssetInfo {
  hostname: string
  mac: string
  os: string
  cpu: string
  cpuCores: number
  memTotalMB: number
  disks: DiskInfo[]
  nics: NicInfo[]
}

/** 采集记录表 collect_records 的行（snake_case 对齐表结构） */
export interface CollectRecord {
  id: number
  hostname: string
  mac: string | null
  config_cpu: string | null
  config_memory: string | null
  config_disk: string | null
  os: string
  cpu: string
  cpu_cores: number
  mem_total_mb: number
  disks_json: string
  nics_json: string
  collected_at: string
}

/** 采集结果（含去重与资产联动信息） */
export interface CollectResult extends AssetInfo {
  id: number
  /** 按 hostname+MAC 匹配到的资产编号；未登记为 null */
  matchedAssetNo: string | null
  /** true = 本机已采集过（未重复入库），id 指向已有记录 */
  duplicated: boolean
  /** duplicated 时给出首次采集时间，用于页面提示 */
  firstCollectedAt?: string
}

// ---------- 组织架构 ----------

export interface Department {
  id: number
  name: string
  parent_id: number | null
  remark: string | null
  sort: number
  created_at: string
}

/** 部门树节点（含直接人数统计，前端 el-tree 用） */
export interface DepartmentNode extends Department {
  children: DepartmentNode[]
  /** 本部门（不含子部门）在职员工数 */
  emp_count: number
}

// ---------- 员工 ----------

export type EmployeeStatus = 'active' | 'left'

export interface Employee {
  id: number
  emp_no: string
  name: string
  dept_id: number
  /** 完整部门路径，如 "研发中心/前端组"（联查拼出） */
  dept_path?: string
  position: string | null
  hire_date: string | null
  status: EmployeeStatus
  leave_date: string | null
  /** 名下资产数量（联查统计） */
  asset_count?: number
  /** 名下未报废资产的设备清单数量合计（联查统计） */
  device_count?: number
  created_at: string
}

export interface EmployeeInput {
  emp_no: string
  name: string
  dept_id: number
  position?: string | null
  hire_date?: string | null
}

export interface EmployeeQuery {
  keyword?: string
  deptId?: number
  status?: EmployeeStatus | ''
  page?: number
  pageSize?: number
}

// ---------- 资产 ----------

export type AssetCategory = 'PC' | 'NB' | 'MON' | 'SRV' | 'OTH'

export type AssetStatus = 'idle' | 'inuse' | 'repair' | 'pending_recycle' | 'scrapped'

export type CompType =
  | 'host' | 'laptop' | 'cpu' | 'memory' | 'disk' | 'monitor' | 'psu' | 'kbmouse' | 'peripheral'

export type CompSource = 'auto' | 'manual'
export interface DeviceTypeOption { id: number; value: string; name: string; is_preset: boolean }
export interface AssetCategoryOption extends DeviceTypeOption { device_types: DeviceTypeOption[] }

export interface AssetComponent {
  id?: number
  asset_id?: number
  comp_type: CompType
  brand_model: string
  sn?: string
  spec: string
  quantity: number
  source: CompSource
  remark: string
}

export interface Asset {
  id: number
  asset_no: string
  category: AssetCategory
  brand_model: string
  sn: string | null
  employee_id: number | null
  /** 联查带出：归属员工姓名 / 部门路径 */
  emp_name?: string | null
  dept_path?: string | null
  status: AssetStatus
  location: string | null
  /** 采集联动匹配因子（详情页可手工绑定） */
  hostname: string | null
  mac: string | null
  /** 办公电脑配置快照 */
  config_cpu: string | null
  config_memory: string | null
  config_disk: string | null
  original_value: number | null
  condition_score: number | null
  remark: string | null
  created_at: string
  updated_at: string
  /** 应用层现算的当前净值（不入库，理由见 depreciation.ts） */
  net_value?: number | null
}

export interface AssetInput {
  asset_no?: string // 不传则自动生成
  category: AssetCategory
  brand_model: string
  sn?: string | null
  employee_id?: number | null
  status: AssetStatus
  location?: string | null
  hostname?: string | null
  mac?: string | null
  config_cpu?: string | null
  config_memory?: string | null
  config_disk?: string | null
  original_value?: number | null
  condition_score?: number | null
  remark?: string | null
  components: AssetComponent[]
}

export interface AssetQuery {
  category?: AssetCategory | ''
  status?: AssetStatus | ''
  condition?: 'low' | ''
  deptId?: number
  keyword?: string
  page: number
  pageSize: number
}

export interface PagedResult<T> {
  rows: T[]
  total: number
}

export interface AssetStats {
  total: number
  inuse: number
  idle: number
  repair: number
  pendingRecycle: number
  scrapped: number
  totalNetValue: number
}

// ---------- 设备总览（组件平铺视图） ----------

export interface DeviceRow extends AssetComponent {
  asset_no: string
  asset_status: AssetStatus
  emp_name: string | null
  dept_path: string | null
}

export interface DeviceQuery {
  compType?: CompType | ''
  source?: CompSource | ''
  keyword?: string
  page: number
  pageSize: number
}

// ---------- 审计 ----------

export interface AuditRecord {
  id: number
  action: string
  detail: string
  at: string
}
