<!-- ==================== 审计日志（只读） ==================== -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useElectron } from '../composables/useElectron';
import { errMsg } from '../utils';
import type { AuditRecord } from '../../../shared/types';

const api = useElectron();
const rows = ref<AuditRecord[]>([]);
const loading = ref(false);
const keyword = ref('');
const action = ref('');
const ACTION_LABELS: Record<string, string> = {
  'asset-create': '登记资产',
  'asset-update': '编辑资产',
  'asset-scrap': '报废资产',
  'asset-recycle': '确认回收',
  'emp-create': '新增员工',
  'emp-update': '编辑员工',
  'emp-mark-left': '标记员工离职',
  'dept-create': '新增部门',
  'dept-update': '编辑部门',
  'dept-move': '调整部门层级',
  'dept-delete': '删除部门',
  'category-create': '新增资产分类',
  'category-update': '编辑资产分类',
  'category-delete': '删除资产分类',
  'category-set-devices': '配置分类设备类型',
  'device-type-create': '新增设备类型',
  'device-type-update': '编辑设备类型',
  'device-type-delete': '删除设备类型',
  'config-preview': '获取本机配置',
  export: '导出台账',
  'print-blocked': '拦截打印',
  'download-blocked': '拦截下载',
  'smoke-test': '冒烟测试',
  'seed-rich': '补充演示数据',
};
const actionOptions = computed(() => {
  const known = Object.entries(ACTION_LABELS).map(([value, label]) => ({
    value,
    label, 
  }));
  const extra = [...new Set(rows.value.map((row) => row.action))].filter((value) => !ACTION_LABELS[value]).map((value) => ({
    value,
    label: value, 
  }));

  return [...known, ...extra];
});
const filteredRows = computed(() => rows.value.filter((row) =>
  (!action.value || row.action === action.value) &&
  (!keyword.value || row.action.includes(keyword.value) || row.detail.includes(keyword.value)),
));

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await api.listAudits(500);
  } catch (e) {
    ElMessage.error(errMsg(e));
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
</script>

<template>
  <h2 class="page-title">
    审计日志
  </h2>
  <p class="page-sub">
    所有写操作与管控拦截的只读记录
  </p>
  <div class="filter-bar">
    <el-select v-model="action" clearable placeholder="动作" style="width: 160px;">
      <el-option v-for="option in actionOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>
    <el-input v-model="keyword" placeholder="按动作/详情过滤（前端过滤）" clearable style="width: 260px;" />
    <el-button @click="refresh">
      刷新
    </el-button>
  </div>
  <div class="data-table-wrap audit-table-wrap">
    <el-table
      v-loading="loading"
      height="100%"
      :data="filteredRows" border stripe empty-text="暂无审计记录"
    >
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="动作" width="150">
        <template #default="{ row }">
          {{ ACTION_LABELS[row.action] ?? row.action }}
        </template>
      </el-table-column>
      <el-table-column prop="detail" label="详情" min-width="380" show-overflow-tooltip />
      <el-table-column prop="at" label="时间" width="230" />
    </el-table>
  </div>
</template>

<style scoped>
.audit-table-wrap {
  height: clamp(300px, calc(100vh - 230px), 760px);
}
</style>
