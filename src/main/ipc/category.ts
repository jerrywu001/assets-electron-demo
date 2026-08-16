import { IpcChannel } from '../../shared/ipc';
import { handle } from './handle';
import { insertAudit } from '../db/audit';
import {
  listCategories, listDeviceTypes, createCategory, updateCategory, deleteCategory,
  setCategoryDevices, createDeviceType, updateDeviceType, deleteDeviceType,
} from '../db/category';

export function registerCategoryIpc(): void {
  handle<[], any[]>(IpcChannel.CategoryList, () => listCategories());
  handle<[], any[]>(IpcChannel.CategoryDeviceTypes, () => listDeviceTypes());
  handle<[{ name: string }], number>(IpcChannel.CategoryCreate, async (input) => {
    const id = await createCategory(input.name);

    await insertAudit('category-create', `新增资产分类: ${input.name} (id=${id})`);
    return id;
  });
  handle<[number, string], void>((IpcChannel as any).CategoryUpdate, async (id, name) => {
    await updateCategory(id, name);
    await insertAudit('category-update', `修改资产分类 id=${id}: ${name}`);
  });
  handle<[number], void>(IpcChannel.CategoryDelete, async (id) => {
    await deleteCategory(id);
    await insertAudit('category-delete', `删除资产分类 id=${id}`);
  });
  handle<[number, number[]], void>(IpcChannel.CategorySetDevices, async (id, deviceTypeIds) => {
    await setCategoryDevices(id, deviceTypeIds);
    await insertAudit('category-set-devices', `配置资产分类 id=${id} 的设备类型: ${deviceTypeIds.join(',') || '无'}`);
  });
  handle<[{
    categoryId: number;
    name: string; 
  }], number>(IpcChannel.DeviceTypeCreate, async (input) => {
    const id = await createDeviceType(input.categoryId, input.name);

    await insertAudit('device-type-create', `新增设备类型: ${input.name} (id=${id})`);
    return id;
  });
  handle<[number, string], void>(IpcChannel.DeviceTypeUpdate, async (id, name) => {
    await updateDeviceType(id, name);
    await insertAudit('device-type-update', `修改设备类型 id=${id}: ${name}`);
  });
  handle<[number], void>(IpcChannel.DeviceTypeDelete, async (id) => {
    await deleteDeviceType(id);
    await insertAudit('device-type-delete', `删除设备类型 id=${id}`);
  });
}
