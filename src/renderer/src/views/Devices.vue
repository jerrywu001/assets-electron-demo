<!-- ==================== 设备总览（全局组件平铺视图，只读） ==================== -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useElectron } from '../composables/useElectron'
import { errMsg } from '../utils'
import { STATUS_LABELS } from '../../../shared/depreciation'
import AssetDetailDrawer from '../components/AssetDetailDrawer.vue'
import type { DeviceQuery, DeviceRow } from '../../../shared/types'

const api = useElectron()
const query = reactive<DeviceQuery>({ compType: '', source: '', keyword: '', page: 1, pageSize: 20 })
const rows = ref<DeviceRow[]>([])
const total = ref(0)
const loading = ref(false)
const detailId = ref<number | null>(null)
const categories = ref<any[]>([])
const deviceTypeLabels = computed<Record<string, string>>(() => Object.fromEntries(categories.value.flatMap((c) => c.device_types.map((t: any) => [t.value, t.name]))))

async function refresh(): Promise<void> {
  loading.value = true
  rows.value = []
  try {
    const paged = await api.listDevices(query)
    const unique = new Map<string, DeviceRow>()
    for (const row of paged.rows) {
      const key = `${row.asset_id}|${row.comp_type}|${row.brand_model ?? ''}|${row.sn ?? ''}`
      if (!unique.has(key)) unique.set(key, row)
    }
    rows.value = [...unique.values()]
    total.value = rows.value.length
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

onMounted(async () => { categories.value = await api.listCategories(); await refresh() })
</script>

<template>
  <h2 class="page-title">设备总览</h2>
  <p class="page-sub">跨资产的设备平铺视图（只读）：筛「显示器」看全公司分布，筛「自动」看哪些机器采集过配置；点击资产编号跳转详情</p>

  <div class="filter-bar">
    <el-select v-model="query.compType" placeholder="设备类型" clearable style="width: 140px" @change="search">
      <el-option v-for="(label, key) in deviceTypeLabels" :key="key" :label="label" :value="key" />
    </el-select>
    <el-select v-model="query.source" placeholder="来源" clearable style="width: 110px" @change="search">
      <el-option label="自动" value="auto" />
      <el-option label="手工" value="manual" />
    </el-select>
    <el-input v-model="query.keyword" placeholder="型号 / 规格 / 资产编号" clearable style="width: 200px"
      @keyup.enter="search" @clear="search" />
    <el-button type="primary" @click="search">查询</el-button>
  </div>

  <div class="data-table-wrap device-table-wrap"><el-table height="100%" :data="rows" border stripe v-loading="loading" empty-text="暂无组件数据">
    <el-table-column label="所属资产" width="210">
      <template #default="{ row }">
        <el-button class="device-asset-link" link type="primary" @click="detailId = row.asset_id ?? null">{{ row.asset_no }}</el-button>
      </template>
    </el-table-column>
    <el-table-column label="资产状态" width="90">
      <template #default="{ row }">
        <el-tag size="small">{{ STATUS_LABELS[row.asset_status as keyof typeof STATUS_LABELS] }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="设备类型" width="100">
      <template #default="{ row }">{{ deviceTypeLabels[row.comp_type] || row.comp_type }}</template>
    </el-table-column>
    <el-table-column prop="brand_model" label="品牌型号" min-width="220" show-overflow-tooltip />
    <el-table-column prop="sn" label="序列号 SN" min-width="180" show-overflow-tooltip />
    <el-table-column prop="spec" label="规格参数" min-width="130" show-overflow-tooltip />
    <el-table-column prop="quantity" label="数量" width="60" />
    <el-table-column label="归属员工（部门）" min-width="260" show-overflow-tooltip>
      <template #default="{ row }">
        {{ row.emp_name ? `${row.emp_name}（${row.dept_path}）` : '-' }}
      </template>
    </el-table-column>
    <el-table-column label="来源" width="70">
      <template #default="{ row }">
        <el-tag size="small" :type="row.source === 'auto' ? 'success' : 'info'">
          {{ row.source === 'auto' ? '自动' : '手工' }}
        </el-tag>
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

  <AssetDetailDrawer v-model:asset-id="detailId" />
</template>

<style scoped>
 .device-table-wrap { height: clamp(300px, calc(100vh - 270px), 800px); }
 .device-asset-link { color: #2563eb !important; }
 .device-asset-link:hover { color: #1d4ed8 !important; }
</style>
