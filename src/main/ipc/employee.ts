// ==================== IPC：员工管理 ====================
import { IpcChannel } from '../../shared/ipc'
import { handle } from './handle'
import {
  createEmployee, listEmployees, markEmpLeft, previewEmpLeft, updateEmployee
} from '../db/employee'
import { insertAudit } from '../db/audit'
import type { Asset, Employee, EmployeeInput, EmployeeQuery, PagedResult } from '../../shared/types'

export function registerEmployeeIpc(): void {
  handle<[EmployeeQuery], PagedResult<Employee>>(IpcChannel.EmpList, (query) => listEmployees(query))

  handle<[EmployeeInput], number>(IpcChannel.EmpCreate, async (input) => {
    const id = await createEmployee(input)
    await insertAudit('emp-create', `新增员工: ${input.name} (${input.emp_no})`)
    return id
  })

  handle<[number, EmployeeInput], void>(IpcChannel.EmpUpdate, async (id, input) => {
    await updateEmployee(id, input)
    await insertAudit('emp-update', `修改员工 id=${id}: ${input.name} (${input.emp_no})`)
  })

  // 离职预检（R1）：前端先调这个拿"在用"资产列表弹窗，确认后再调 mark-left
  handle<[number], Asset[]>(IpcChannel.EmpPreviewLeft, (id) => previewEmpLeft(id))

  handle<[number, string], number>(IpcChannel.EmpMarkLeft, async (id, leaveDate) => {
    const affected = await markEmpLeft(id, leaveDate)
    await insertAudit(
      'emp-mark-left',
      `员工 id=${id} 标记离职(${leaveDate})，${affected} 台在用资产转入待回收`
    )
    return affected
  })
}
