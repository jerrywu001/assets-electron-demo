// ==================== IPC 契约：渠道常量 + 接口定义 ====================
// 面试要点：把 IPC 当成"接口调用"来设计——
// 渠道名集中定义避免字符串硬编码散落各处，
// AssetApi 接口同时约束 preload 的实现和渲染端的调用。
import type {
  Asset,
  AssetInfo,
  AssetComponent,
  AssetInput,
  AssetQuery,
  AssetStats,
  AuditRecord,
  CollectRecord,
  CollectResult,
  DepartmentNode,
  DeviceQuery,
  DeviceRow,
  Employee,
  EmployeeInput,
  EmployeeQuery,
  PagedResult,
} from './types';

export const IpcChannel = {
  // 采集
  PreviewCollect: 'collect:preview',
  // 部门
  DeptTree: 'dept:tree',
  DeptCreate: 'dept:create',
  DeptUpdate: 'dept:update',
  DeptMove: 'dept:move',
  DeptDelete: 'dept:delete',
  DeptEmployees: 'dept:employees',
  // 员工
  EmpList: 'emp:list',
  EmpCreate: 'emp:create',
  EmpUpdate: 'emp:update',
  EmpPreviewLeft: 'emp:preview-left',
  EmpMarkLeft: 'emp:mark-left',
  // 资产
  AssetNextNo: 'asset:next-no',
  AssetList: 'asset:list',
  AssetGet: 'asset:get',
  AssetCreate: 'asset:create',
  AssetUpdate: 'asset:update',
  AssetScrap: 'asset:scrap',
  AssetConfirmRecycle: 'asset:confirm-recycle',
  AssetStats: 'asset:stats',
  // 设备总览
  DeviceList: 'device:list',
  // 导出 / 审计
  ExportExcel: 'export:excel',
  AuditList: 'audit:list',
  AuditNotice: 'audit:notice',
  // 无边框窗口控制
  WindowControl: 'window:control',
  CategoryList: 'category:list',
  CategoryDeviceTypes: 'category:device-types',
  CategoryCreate: 'category:create',
  CategoryUpdate: 'category:update',
  CategoryDelete: 'category:delete',
  CategorySetDevices: 'category:set-devices',
  DeviceTypeCreate: 'device-type:create',
  DeviceTypeUpdate: 'device-type:update',
  DeviceTypeDelete: 'device-type:delete',
} as const;

export type WindowAction = 'minimize' | 'maximize' | 'close';

export interface DeptInput {
  name: string;
  parent_id: number | null;
  remark?: string | null;
  sort?: number;
}

export interface AssetDetail {
  asset: Asset;
  components: AssetComponent[];
}

/** 渲染进程可调用的 API（preload 通过 contextBridge 实现并暴露） */
export interface AssetApi {
  // ---- 采集 ----
  /** 采集本机信息并入库，同时按 hostname+MAC 匹配资产档案刷新其自动组件行 */
  /** 只采集不入库（登记表单「自动提取本机配置」按钮用） */
  previewCollect(): Promise<AssetInfo>;
  /** 采集记录列表 */

  // ---- 部门 ----
  getDeptTree(): Promise<DepartmentNode[]>;
  createDept(input: DeptInput): Promise<number>;
  updateDept(id: number, input: Partial<DeptInput>): Promise<void>;
  moveDept(id: number, newParentId: number | null): Promise<void>;
  /** 有子部门或（含子孙部门）有员工时拒绝并抛错 */
  deleteDept(id: number): Promise<void>;
  /** 某部门（含所有子孙部门）的员工列表 */
  listDeptEmployees(deptId: number): Promise<Employee[]>;

  // ---- 员工 ----
  listEmployees(query: EmployeeQuery): Promise<PagedResult<Employee>>;
  createEmployee(input: EmployeeInput): Promise<number>;
  updateEmployee(id: number, input: EmployeeInput): Promise<void>;
  /** 离职预检：返回该员工名下"在用"资产（R1 弹窗用） */
  previewEmpLeft(id: number): Promise<Asset[]>;
  /** 标记离职：事务内把名下在用资产转"待回收"，返回受影响资产数 */
  markEmpLeft(id: number, leaveDate: string): Promise<number>;

  // ---- 资产 ----
  /** 按分类预生成下一个资产编号（表单展示用，入库时还会重算兜底） */
  nextAssetNo(category: string): Promise<string>;
  listAssets(query: AssetQuery): Promise<PagedResult<Asset>>;
  getAsset(id: number): Promise<AssetDetail>;
  createAsset(input: AssetInput): Promise<number>;
  updateAsset(id: number, input: AssetInput): Promise<void>;
  /** 报废（终态，前端需二次确认） */
  scrapAsset(id: number): Promise<void>;
  /** IT 确认回收：待回收 → 闲置并解除归属 */
  confirmRecycle(id: number): Promise<void>;
  assetStats(): Promise<AssetStats>;
  listCategories(): Promise<import('./types').AssetCategoryOption[]>;
  listDeviceTypes(): Promise<import('./types').DeviceTypeOption[]>;
  createCategory(input: { name: string }): Promise<number>;
  updateCategory(id: number, name: string): Promise<void>;
  deleteCategory(id: number): Promise<void>;
  setCategoryDevices(id: number, deviceTypeIds: number[]): Promise<void>;
  createDeviceType(input: {
    categoryId: number;
    name: string; 
  }): Promise<number>;
  updateDeviceType(id: number, name: string): Promise<void>;
  deleteDeviceType(id: number): Promise<void>;

  // ---- 设备总览 ----
  listDevices(query: DeviceQuery): Promise<PagedResult<DeviceRow>>;

  // ---- 导出 / 审计 ----
  /** 按当前筛选导出台账 Excel（台账 + 组件明细双 sheet），取消返回 null */
  exportExcel(query: AssetQuery): Promise<string | null>;
  listAudits(limit?: number): Promise<AuditRecord[]>;
  /** 订阅主进程的管控通知（打印/下载被拦截时推送） */
  onAuditNotice(cb: (msg: string) => void): void;
  /** 无边框窗口的最小化/最大化/关闭 */
  windowControl(action: WindowAction): Promise<void>;
}
