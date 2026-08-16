<!-- ==================== 员工管理 ==================== -->
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useElectron } from '../composables/useElectron'
import { errMsg } from '../utils'
import type { DepartmentNode, Employee, EmployeeInput, EmployeeQuery } from '../../../shared/types'

const api = useElectron()
const query = reactive<EmployeeQuery>({ keyword: '', status: '', page: 1, pageSize: 20 })
const rows = ref<Employee[]>([])
const total = ref(0)
const loading = ref(false)
const deptTree = ref<DepartmentNode[]>([])
const treeProps = { label: 'name', children: 'children' }
const employeeTreeProps = { label: 'name', children: 'children', disabled: (data: DepartmentNode) => data.parent_id == null || data.children?.length > 0 }

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<EmployeeInput>({ emp_no: '', name: '', dept_id: 0, position: '', hire_date: null })

async function refresh(): Promise<void> {
  loading.value = true
  rows.value = []
  try {
    const result = await api.listEmployees(query)
    // Keep the renderer compatible with a still-running pre-pagination main process.
    if (Array.isArray(result)) {
      rows.value = result
      total.value = result.length
    } else {
      rows.value = result.rows
      total.value = result.total
    }
  } catch (e) {
    ElMessage.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, { emp_no: '', name: '', dept_id: undefined, position: '', hire_date: null })
  dialogVisible.value = true
}

function search(): void {
  query.page = 1
  void refresh()
}

function openEdit(row: Employee): void {
  editingId.value = row.id
  Object.assign(form, {
    emp_no: row.emp_no, name: row.name, dept_id: row.dept_id,
    position: row.position, hire_date: row.hire_date
  })
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  if (!form.emp_no.trim() || !form.name.trim() || !form.dept_id) {
    ElMessage.warning('工号、姓名、部门为必填项')
    return
  }
  try {
    if (editingId.value) {
      await api.updateEmployee(editingId.value, form)
      ElMessage.success('已保存')
    } else {
      await api.createEmployee(form)
      ElMessage.success('已新增')
    }
    dialogVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error(errMsg(e))
  }
}

/** 离职流程（R1）：先预检名下在用资产并弹窗列出，确认后才标记离职 */
async function markLeft(row: Employee): Promise<void> {
  let inuseList: string
  try {
    const assets = await api.previewEmpLeft(row.id)
    inuseList = assets.length
      ? `名下在用资产 ${assets.length} 台：\n${assets.map((a) => `· ${a.asset_no}`).join('\n')}\n\n回收后这些资产将转为"待回收"。`
      : '该员工名下无在用资产。'
  } catch (e) {
    ElMessage.error(errMsg(e))
    return
  }

  let leaveDate: string
  try {
    const { value } = await ElMessageBox.prompt(
      `${row.name}（${row.emp_no}）\n${inuseList}\n请输入离职日期：`,
      '标记离职',
      {
        confirmButtonText: '确认离职',
        cancelButtonText: '取消',
        inputValue: new Date().toISOString().slice(0, 10),
        inputPattern: /^\d{4}-\d{2}-\d{2}$/,
        inputErrorMessage: '日期格式应为 YYYY-MM-DD'
      }
    )
    leaveDate = value
  } catch {
    return
  }

  try {
    const affected = await api.markEmpLeft(row.id, leaveDate)
    ElMessage.success(`已标记离职，${affected} 台资产转入待回收`)
    await refresh()
  } catch (e) {
    ElMessage.error(errMsg(e))
  }
}

onMounted(async () => {
  deptTree.value = await api.getDeptTree()
  await refresh()
})
</script>

<template>
  <h2 class="page-title">员工管理</h2>
  <p class="page-sub">员工档案与在职状态，离职自动触发资产回收流程</p>

  <div class="filter-bar">
    <el-input v-model="query.keyword" placeholder="工号 / 姓名 / 职位" clearable style="width: 200px"
      @keyup.enter="search" @clear="search" />
    <el-select v-model="query.status" placeholder="在职状态" clearable style="width: 120px" @change="refresh">
      <el-option label="在职" value="active" />
    <el-option label="已离职" value="left" />
    </el-select>
    <el-button type="primary" @click="search">查询</el-button>
    <el-button class="create-employee" type="success" @click="openCreate">新增员工</el-button>
  </div>

  <div class="data-table-wrap employee-table-wrap"><el-table height="100%" :data="rows" border stripe v-loading="loading" empty-text="暂无员工">
    <el-table-column prop="emp_no" label="工号" width="110" />
    <el-table-column prop="name" label="姓名" width="110" />
    <el-table-column prop="dept_path" label="部门" min-width="180" show-overflow-tooltip />
    <el-table-column prop="position" label="职位" width="130" show-overflow-tooltip />
    <el-table-column prop="hire_date" label="入职日期" width="110" />
    <el-table-column label="状态" width="90">
      <template #default="{ row }">
        <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
          {{ row.status === 'active' ? '在职' : '已离职' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="leave_date" label="离职日期" width="110">
      <template #default="{ row }">{{ row.leave_date || '-' }}</template>
    </el-table-column>
        <el-table-column label="名下资产" width="120">
          <template #default="{ row }">{{ row.asset_count ?? 0 }}资产共{{ row.device_count ?? 0 }}设备</template>
    </el-table-column>
    <el-table-column label="操作" width="150" fixed="right">
      <template #default="{ row }">
        <el-button class="employee-edit-link" link type="primary" @click="openEdit(row)">编辑</el-button>
        <el-button v-if="row.status === 'active'" link type="danger" @click="markLeft(row)">标记离职</el-button>
      </template>
    </el-table-column>
  </el-table></div>

  <el-pagination
    style="margin-top: 16px; justify-content: flex-end"
    background layout="total, prev, pager, next, sizes"
    :total="total"
    v-model:current-page="query.page"
    v-model:page-size="query.pageSize"
    :page-sizes="[10, 20, 50, 100]"
    @current-change="refresh"
    @size-change="search"
  />

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑员工' : '新增员工'" width="480px">
    <el-form label-width="90px">
      <el-form-item label="工号" required>
        <el-input v-model="form.emp_no" />
      </el-form-item>
      <el-form-item label="姓名" required>
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="部门" required>
        <el-tree-select
          v-model="form.dept_id" :data="deptTree" :props="employeeTreeProps" node-key="id"
          check-strictly placeholder="可挂任意层级" style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="职位">
        <el-input v-model="form.position" />
      </el-form-item>
      <el-form-item label="入职日期">
        <el-date-picker v-model="form.hire_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.create-employee {
  margin-left: auto;
}
.employee-table-wrap { height: clamp(300px, calc(100vh - 270px), 800px); }
.employee-edit-link { color: #2563eb !important; }
.employee-edit-link:hover { color: #1d4ed8 !important; }
</style>
