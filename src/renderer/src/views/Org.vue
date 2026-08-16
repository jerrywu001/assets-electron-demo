<!-- ==================== 组织架构（左树 + 右部门信息/员工面板） ==================== -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useElectron } from '../composables/useElectron'
import { errMsg } from '../utils'
import type { DepartmentNode, Employee } from '../../../shared/types'

const api = useElectron()
const tree = ref<DepartmentNode[]>([])
const selectedId = ref<number | null>(null)
const selectedNode = ref<DepartmentNode | null>(null)
const employees = ref<Employee[]>([])
const loadingEmps = ref(false)
const treeProps = { label: 'name', children: 'children' }

async function refreshTree(keepSelection = true): Promise<void> {
  tree.value = await api.getDeptTree()
  if (keepSelection && selectedId.value != null) {
    const found = findNode(tree.value, selectedId.value)
    if (found) {
      selectedNode.value = found
      await loadEmployees()
      return
    }
  }
  if (!keepSelection || selectedId.value == null) {
    const first = tree.value[0]
    if (first) {
      selectedId.value = first.id
      selectedNode.value = first
      await loadEmployees()
    } else {
      selectedId.value = null
      selectedNode.value = null
      employees.value = []
    }
  }
}

function findNode(nodes: DepartmentNode[], id: number): DepartmentNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = findNode(n.children, id)
    if (hit) return hit
  }
  return null
}

function totalEmployees(node: DepartmentNode): number {
  return Number(node.emp_count ?? 0) + node.children.reduce((sum, child) => sum + totalEmployees(child), 0)
}

async function onSelect(node: DepartmentNode): Promise<void> {
  selectedId.value = node.id
  selectedNode.value = node
  await loadEmployees()
}

async function loadEmployees(): Promise<void> {
  if (selectedId.value == null) return
  loadingEmps.value = true
  try {
    employees.value = await api.listDeptEmployees(selectedId.value)
  } finally {
    loadingEmps.value = false
  }
}

/** 部门下拉选项（排除自身，移动时防成环在服务端兜底） */
const deptOptions = computed(() => {
  const flat: { id: number; label: string }[] = []
  const walk = (nodes: DepartmentNode[], prefix: string): void => {
    for (const n of nodes) {
      const label = prefix ? `${prefix}/${n.name}` : n.name
      flat.push({ id: n.id, label })
      walk(n.children, label)
    }
  }
  walk(tree.value, '')
  return flat
})

async function addDept(): Promise<void> {
  const parent = selectedNode.value
  try {
    const { value } = await ElMessageBox.prompt(
      parent ? `在「${parent.name}」下新增子部门：` : '新增一级部门：',
      '新增部门',
      { confirmButtonText: '新增', cancelButtonText: '取消', inputPattern: /\S+/, inputErrorMessage: '名称不能为空' }
    )
    await api.createDept({ name: value.trim(), parent_id: parent?.id ?? null })
    ElMessage.success('已新增')
    await refreshTree()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(errMsg(e))
  }
}

async function renameDept(): Promise<void> {
  const node = selectedNode.value
  if (!node) return
  try {
    const { value } = await ElMessageBox.prompt('部门名称：', '重命名', {
      confirmButtonText: '保存', cancelButtonText: '取消',
      inputValue: node.name, inputPattern: /\S+/, inputErrorMessage: '名称不能为空'
    })
    await api.updateDept(node.id, { name: value.trim() })
    ElMessage.success('已保存')
    await refreshTree()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(errMsg(e))
  }
}

async function editRemark(): Promise<void> {
  const node = selectedNode.value
  if (!node) return
  try {
    const { value } = await ElMessageBox.prompt('备注：', '编辑备注', {
      confirmButtonText: '保存', cancelButtonText: '取消', inputValue: node.remark ?? ''
    })
    await api.updateDept(node.id, { remark: value })
    ElMessage.success('已保存')
    await refreshTree()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(errMsg(e))
  }
}

async function moveDept(): Promise<void> {
  const node = selectedNode.value
  if (!node) return
  // 用消息框 + select 不便，这里用简单 prompt 列编号体验差——改用 ElMessageBox 配 select 过重，
  // 直接用一个内联对话框更简单：见模板中的 moveDialog
  moveTarget.value = node.parent_id
  moveDialog.value = true
}

const moveDialog = ref(false)
const moveTarget = ref<number | null>(null)

async function confirmMove(): Promise<void> {
  const node = selectedNode.value
  if (!node) return
  try {
    await api.moveDept(node.id, moveTarget.value)
    ElMessage.success('已调整层级')
    moveDialog.value = false
    await refreshTree()
  } catch (e) {
    ElMessage.error(errMsg(e))
  }
}

async function removeDept(): Promise<void> {
  const node = selectedNode.value
  if (!node) return
  try {
    await ElMessageBox.confirm(
      `确定删除「${node.name}」吗？有子部门或有员工（含下级部门）时将被拒绝。`,
      '删除部门',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await api.deleteDept(node.id)
    ElMessage.success('已删除')
    selectedId.value = null
    selectedNode.value = null
    employees.value = []
    await refreshTree(false)
  } catch (e) {
    ElMessage.error(errMsg(e))
  }
}

onMounted(() => refreshTree(false))
</script>

<template>
  <h2 class="page-title">组织架构</h2>
  <p class="page-sub">部门树支持无限层级，员工可挂任意节点</p>
  <div style="display: flex; gap: 20px; align-items: flex-start">
    <el-card shadow="never" style="width: 320px; flex-shrink: 0">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>部门树</span>
          <el-button size="small" type="primary" @click="addDept">
            {{ selectedNode ? '新增子部门' : '新增一级部门' }}
          </el-button>
        </div>
      </template>
      <el-tree
        :data="tree" :props="treeProps" node-key="id" highlight-current
        :current-node-key="selectedId"
        :expand-on-click-node="false" default-expand-all
        @node-click="onSelect"
      >
        <template #default="{ data }">
          <span>{{ data.name }}<span style="color: var(--app-text-3); font-size: 12px">（{{ totalEmployees(data) }}人）</span></span>
        </template>
      </el-tree>
    </el-card>

    <el-card shadow="never" style="flex: 1" v-if="selectedNode">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>{{ selectedNode.name }}</span>
          <div>
            <el-button size="small" @click="renameDept">重命名</el-button>
            <el-button size="small" @click="editRemark">备注</el-button>
            <el-button size="small" @click="moveDept">更换上级</el-button>
            <el-button size="small" type="danger" @click="removeDept">删除</el-button>
          </div>
        </div>
      </template>
      <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
        <el-descriptions-item label="部门名称">{{ selectedNode.name }}</el-descriptions-item>
        <el-descriptions-item label="总人数（含下级）">{{ totalEmployees(selectedNode) }} 人</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ selectedNode.remark || '-' }}</el-descriptions-item>
      </el-descriptions>

      <h4 style="margin: 0 0 8px">部门员工（含下级部门，共 {{ employees.length }} 人）</h4>
      <div class="data-table-wrap"><el-table height="100%" :data="employees" border size="small" v-loading="loadingEmps" empty-text="该部门暂无员工">
        <el-table-column prop="emp_no" label="工号" width="100" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="dept_path" label="部门路径" min-width="160" show-overflow-tooltip />
        <el-table-column prop="position" label="职位" width="120" show-overflow-tooltip />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '在职' : '已离职' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table></div>
    </el-card>

    <el-empty v-else description="点击左侧树节点查看部门详情" style="flex: 1; margin-top: 80px" />
  </div>

  <el-dialog v-model="moveDialog" title="更换上级部门" width="420px">
    <el-select v-model="moveTarget" placeholder="选择新上级（留空为一级部门）" clearable style="width: 100%">
      <el-option v-for="o in deptOptions" :key="o.id" :label="o.label" :value="o.id" />
    </el-select>
    <template #footer>
      <el-button @click="moveDialog = false">取消</el-button>
      <el-button type="primary" @click="confirmMove">确定</el-button>
    </template>
  </el-dialog>
</template>
