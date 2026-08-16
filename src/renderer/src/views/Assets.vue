<!-- ==================== 资产台账（列表页） ==================== -->
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useElectron } from '../composables/useElectron'
import { errMsg, fmtMoney } from '../utils'
import { CATEGORY_LABELS, STATUS_LABELS } from '../../../shared/depreciation'
import AssetDetailDrawer from '../components/AssetDetailDrawer.vue'
import type { Asset, AssetQuery, AssetStats, DepartmentNode } from '../../../shared/types'

const api = useElectron()
const router = useRouter()
const route = useRoute()

const query = reactive<AssetQuery>({ category: '', status: '', deptId: undefined, keyword: '', page: 1, pageSize: 20 })
const rows = ref<Asset[]>([])
const total = ref(0)
const loading = ref(false)
const stats = ref<AssetStats | null>(null)
const deptTree = ref<DepartmentNode[]>([])
const detailId = ref<number | null>(null)

const treeProps = { label: 'name', children: 'children' }

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [paged, s] = await Promise.all([api.listAssets(query), api.assetStats()])
    rows.value = paged.rows
    total.value = paged.total
    stats.value = s
  } catch (e) {
    ElMessage.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function search(): void {
  query.page = 1
  void refresh()
}

async function exportExcel(): Promise<void> {
  try {
    const file = await api.exportExcel(query)
    if (!file) {
      ElMessage.info('已取消导出')
      return
    }
    ElMessageBox.alert(file, '导出成功', { confirmButtonText: '知道了' })
  } catch (e) {
    ElMessage.error(errMsg(e))
  }
}

async function scrap(row: Asset): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定报废 ${row.asset_no} 吗？报废后不可恢复。`,
      '报废确认',
      { type: 'warning', confirmButtonText: '确认报废', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await api.scrapAsset(row.id)
    ElMessage.success('已报废')
    await refresh()
  } catch (e) {
    ElMessage.error(errMsg(e))
  }
}

async function recycle(row: Asset): Promise<void> {
  try {
    await api.confirmRecycle(row.id)
    ElMessage.success('已确认回收，资产转为闲置')
    await refresh()
  } catch (e) {
    ElMessage.error(errMsg(e))
  }
}

onMounted(async () => {
  if (typeof route.query.category === 'string') query.category = route.query.category as AssetQuery['category']
  if (typeof route.query.status === 'string') query.status = route.query.status as AssetQuery['status']
  if (typeof route.query.keyword === 'string') query.keyword = route.query.keyword
  if (route.query.condition === 'low') query.condition = 'low'
  deptTree.value = await api.getDeptTree()
  await refresh()
})
</script>

<template>
  <h2 class="page-title">资产台账</h2>
  <p class="page-sub">登记、筛选、盘点与导出全部资产</p>

  <div v-if="stats" class="mb-5 grid grid-cols-2 gap-4 md:grid-cols-5">
    <div class="rounded-xl border border-app-border p-4 transition-shadow hover:shadow-sm">
      <div class="text-xs text-app-text2">资产总数</div>
      <div class="mt-1 text-2xl font-semibold tracking-tight">{{ stats.total }}</div>
    </div>
    <div class="rounded-xl border border-app-border p-4 transition-shadow hover:shadow-sm">
      <div class="text-xs text-app-text2">在用</div>
      <div class="mt-1 text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">{{ stats.inuse }}</div>
    </div>
    <div class="rounded-xl border border-app-border p-4 transition-shadow hover:shadow-sm">
      <div class="text-xs text-app-text2">闲置</div>
      <div class="mt-1 text-2xl font-semibold tracking-tight text-sky-600 dark:text-sky-400">{{ stats.idle }}</div>
    </div>
    <div class="rounded-xl border border-app-border p-4 transition-shadow hover:shadow-sm">
      <div class="text-xs text-app-text2">维修</div>
      <div class="mt-1 text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-400">{{ stats.repair }}</div>
    </div>
    <div class="rounded-xl border border-app-border p-4 transition-shadow hover:shadow-sm">
      <div class="text-xs text-app-text2">账面总净值</div>
      <div class="mt-1 text-2xl font-semibold tracking-tight">{{ fmtMoney(stats.totalNetValue) }}</div>
    </div>
  </div>

  <div class="filter-bar">
    <el-select v-model="query.category" placeholder="分类" clearable style="width: 120px" @change="search">
      <el-option v-for="(label, key) in CATEGORY_LABELS" :key="key" :label="label" :value="key" />
    </el-select>
    <el-select v-model="query.status" placeholder="状态" clearable style="width: 120px" @change="search">
      <el-option v-for="(label, key) in STATUS_LABELS" :key="key" :label="label" :value="key" />
    </el-select>
    <el-tree-select
      v-model="query.deptId"
      :data="deptTree"
      :props="treeProps"
      node-key="id"
      check-strictly
      placeholder="部门"
      clearable
      style="width: 200px"
      @change="search"
    />
    <el-input
      v-model="query.keyword"
      placeholder="编号 / 型号 / SN"
      clearable
      style="width: 200px"
      @keyup.enter="search"
      @clear="search"
    />
    <el-button type="primary" @click="search">查询</el-button>
    <div class="asset-actions">
      <el-button type="success" @click="router.push('/assets/new')">登记资产</el-button>
      <el-button @click="exportExcel">导出台账 Excel</el-button>
    </div>
  </div>

  <div class="asset-table-wrap">
  <el-table height="100%" :data="rows" border stripe v-loading="loading" empty-text="暂无资产，点击「登记资产」">
    <el-table-column prop="asset_no" label="编号" width="150" />
    <el-table-column label="分类" width="140">
      <template #default="{ row }">
        <el-tooltip :content="CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS]" placement="top">
          <span class="category-cell">{{ CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] }}</span>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column label="归属员工（部门）" min-width="180" show-overflow-tooltip>
      <template #default="{ row }">
        {{ row.emp_name ? `${row.emp_name}（${row.dept_path}）` : '-' }}
      </template>
    </el-table-column>
    <el-table-column label="状态" width="90">
      <template #default="{ row }">
        <el-tag size="small" :type="row.status === 'inuse' ? 'success' : row.status === 'scrapped' ? 'danger' : row.status === 'pending_recycle' ? 'warning' : 'info'">
          {{ STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="原值" width="110" align="right">
      <template #default="{ row }">{{ fmtMoney(row.original_value) }}</template>
    </el-table-column>
    <el-table-column prop="condition_score" label="成色" width="70" align="center" />
    <el-table-column label="当前净值" width="110" align="right">
      <template #default="{ row }"><b>{{ fmtMoney(row.net_value) }}</b></template>
    </el-table-column>
    <el-table-column label="最近更新" width="180">
      <template #default="{ row }"><span class="no-wrap">{{ row.updated_at }}</span></template>
    </el-table-column>
    <el-table-column label="操作" width="220" fixed="right">
      <template #default="{ row }">
        <el-button class="asset-action-link" link type="primary" @click="detailId = row.id">详情</el-button>
        <el-button v-if="row.status !== 'scrapped'" class="asset-action-link" link type="primary" @click="router.push(`/assets/${row.id}`)">编辑</el-button>
        <el-button v-if="row.status === 'pending_recycle'" link type="warning" @click="recycle(row)">回收</el-button>
        <el-button v-if="row.status !== 'scrapped'" link type="danger" @click="scrap(row)">报废</el-button>
      </template>
    </el-table-column>
  </el-table>
  </div>

  <el-pagination
    style="margin-top: 16px; justify-content: flex-end"
    background
    layout="total, prev, pager, next, sizes"
    :total="total"
    v-model:current-page="query.page"
    v-model:page-size="query.pageSize"
    :page-sizes="[10, 20, 50, 100]"
    @current-change="refresh"
    @size-change="search"
  />

  <AssetDetailDrawer v-model:asset-id="detailId" />
</template>

<style scoped>
.no-wrap {
  white-space: nowrap;
}
.category-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.asset-table-wrap {
  height: clamp(260px, calc(100vh - 375px), 720px);
  min-height: 240px;
}
.asset-action-link { color: #2563eb !important; }
.asset-action-link:hover { color: #1d4ed8 !important; }
</style>
