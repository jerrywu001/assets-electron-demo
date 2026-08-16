// ==================== IPC 注册入口（按业务模块拆分）====================
// 渠道一多就按域拆分，避免单个 ipc.ts 膨胀（面试可讲）。
import { registerCollectIpc } from './collect';
import { registerDepartmentIpc } from './department';
import { registerEmployeeIpc } from './employee';
import { registerAssetIpc } from './asset';
import { registerMiscIpc } from './misc';
import { registerWindowIpc } from './window';
import { registerCategoryIpc } from './category';

export function registerIpc(): void {
  registerCollectIpc();
  registerDepartmentIpc();
  registerEmployeeIpc();
  registerAssetIpc();
  registerMiscIpc();
  registerWindowIpc();
  registerCategoryIpc();
}
