import { getPool } from './connection';
import type { AssetCategoryOption } from '../../shared/types';
import type { DeviceTypeOption } from '../../shared/types';
export async function listDeviceTypes(): Promise<DeviceTypeOption[]> {
  const [r] = await getPool().query<any[]>('SELECT * FROM device_types ORDER BY id');

  return r; 
}
export async function listCategories(): Promise<AssetCategoryOption[]> {
  const [c] = await getPool().query<any[]>('SELECT * FROM asset_categories ORDER BY is_preset DESC,id'); const [t] = await getPool().query<any[]>('SELECT d.*,r.category_id FROM device_types d LEFT JOIN category_device_types r ON r.device_type_id=d.id ORDER BY d.id');

  return c.map((x) => ({
    ...x,
    device_types: t.filter((y) => y.category_id === x.id).map(({ category_id, ...z }) => z), 
  })); 
}
export async function createCategory(name: string): Promise<number> {
  const [r] = await getPool().query<any>('INSERT INTO asset_categories(value,name) VALUES(?,?)', [`custom_${Date.now().toString(36)}`, name.trim()]);

  return r.insertId; 
}
export async function updateCategory(id: number, name: string): Promise<void> {
  const [r] = await getPool().query<any>('UPDATE asset_categories SET name=? WHERE id=? AND is_preset=FALSE', [name.trim(), id]);

  if (!r.affectedRows) throw new Error('预置分类不可修改'); 
}
export async function deleteCategory(id: number): Promise<void> {
  const p = getPool(); const [a] = await p.query<any[]>('SELECT value,is_preset FROM asset_categories WHERE id=?', [id]);

  if (!a[0]) throw new Error('分类不存在'); if (a[0].is_preset) throw new Error('预置分类不可删除'); const [u] = await p.query<any[]>('SELECT COUNT(*) n FROM assets WHERE category=?', [a[0].value]);

  if (u[0].n) throw new Error('分类已有资产关联，无法删除'); await p.query('DELETE FROM asset_categories WHERE id=?', [id]); 
}
export async function setCategoryDevices(id: number, ids: number[]): Promise<void> {
  const c = await getPool().getConnection();

  try {
    await c.beginTransaction(); await c.query('DELETE FROM category_device_types WHERE category_id=?', [id]); for (const x of ids) await c.query('INSERT INTO category_device_types(category_id,device_type_id) VALUES(?,?)', [id, x]); await c.commit(); 
  } catch (e) {
    await c.rollback(); throw e; 
  } finally {
    c.release(); 
  } 
}
export async function createDeviceType(categoryId: number, name: string): Promise<number> {
  const c = await getPool().getConnection();

  try {
    await c.beginTransaction(); const [r] = await c.query<any>('INSERT INTO device_types(value,name,is_preset) VALUES(?,?,FALSE)', [`custom_${Date.now().toString(36)}`, name.trim()]);

    await c.query('INSERT INTO category_device_types(category_id,device_type_id) VALUES(?,?)', [categoryId, r.insertId]); await c.commit(); return r.insertId; 
  } catch (e) {
    await c.rollback(); throw e; 
  } finally {
    c.release(); 
  } 
}
export async function updateDeviceType(id: number, name: string): Promise<void> {
  const [r] = await getPool().query<any>('UPDATE device_types SET name=? WHERE id=? AND is_preset=FALSE', [name.trim(), id]);

  if (!r.affectedRows) throw new Error('预置设备类型不可修改'); 
}
export async function deleteDeviceType(id: number): Promise<void> {
  const [r] = await getPool().query<any>('DELETE FROM device_types WHERE id=? AND is_preset=FALSE', [id]);

  if (!r.affectedRows) throw new Error('预置设备类型不可删除'); 
}
