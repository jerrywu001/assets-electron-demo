// ==================== IPC：组织架构（部门树） ====================
import { IpcChannel, type DeptInput } from '../../shared/ipc';
import { handle } from './handle';
import { createDept, deleteDept, getDeptTree, listDeptEmployees, moveDept, updateDept } from '../db/department';
import { insertAudit } from '../db/audit';
import type { DepartmentNode, Employee } from '../../shared/types';

export function registerDepartmentIpc(): void {
  handle<[], DepartmentNode[]>(IpcChannel.DeptTree, () => getDeptTree());

  handle<[DeptInput], number>(IpcChannel.DeptCreate, async (input) => {
    const id = await createDept(input);

    await insertAudit('dept-create', `新增部门: ${input.name} (id=${id})`);
    return id;
  });

  handle<[number, Partial<DeptInput>], void>(IpcChannel.DeptUpdate, async (id, input) => {
    await updateDept(id, input);
    await insertAudit('dept-update', `修改部门 id=${id}: ${JSON.stringify(input)}`);
  });

  handle<[number, number | null], void>(IpcChannel.DeptMove, async (id, newParentId) => {
    await moveDept(id, newParentId);
    await insertAudit('dept-move', `部门 id=${id} 更换上级为 ${newParentId ?? '根节点'}`);
  });

  handle<[number], void>(IpcChannel.DeptDelete, async (id) => {
    await deleteDept(id); // 删除保护（R7/R8）在 DAO 层抛错
    await insertAudit('dept-delete', `删除部门 id=${id}`);
  });

  handle<[number], Employee[]>(IpcChannel.DeptEmployees, (deptId) => listDeptEmployees(deptId));
}
