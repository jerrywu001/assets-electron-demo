<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import { useElectron } from '../composables/useElectron';
import { errMsg, fmtMoney } from '../utils';
import { CATEGORY_LABELS, STATUS_LABELS } from '../../../shared/depreciation';
import type { Asset, AssetStats } from '../../../shared/types';

const api = useElectron();
const router = useRouter();
const stats = ref<AssetStats | null>(null);
const assets = ref<Asset[]>([]);
const categories = ref<any[]>([]);
const loading = ref(true);
const statusChartRef = ref<HTMLElement | null>(null);
const categoryChartRef = ref<HTMLElement | null>(null);
const conditionChartRef = ref<HTMLElement | null>(null);
let statusChart: echarts.ECharts | null = null;
let categoryChart: echarts.ECharts | null = null;
let conditionChart: echarts.ECharts | null = null;

const lowCondition = computed(() => assets.value.filter((asset) => (asset.condition_score ?? 10) <= 5));
const trackedAssets = computed(() => assets.value.filter((asset) => asset.status !== 'scrapped'));
const statusItems = computed(() => {
  if (!stats.value) return [];
  return [
    {
      key: 'inuse',
      label: '在用',
      value: stats.value.inuse,
      tone: 'success', 
    },
    {
      key: 'idle',
      label: '闲置',
      value: stats.value.idle,
      tone: 'info', 
    },
    {
      key: 'repair',
      label: '维修中',
      value: stats.value.repair,
      tone: 'warning', 
    },
    {
      key: 'pending_recycle',
      label: '待回收',
      value: stats.value.pendingRecycle,
      tone: 'danger', 
    },
  ];
});
const categoryItems = computed(() => categories.value.map((category) => ({
  name: category.name,
  value: category.value,
  count: trackedAssets.value.filter((asset) => asset.category === category.value).length,
})).filter((item) => item.count > 0));
const recentAssets = computed(() => assets.value.slice(0, 5));
const totalForBar = computed(() => Math.max(1, trackedAssets.value.length));
const conditionItems = computed(() => Array.from({ length: 10 }, (_, index) => ({
  score: index + 1,
  count: trackedAssets.value.filter((asset) => asset.condition_score === index + 1).length,
})));

function openAssets(params: Record<string, string> = {}): void {
  router.push({
    path: '/assets',
    query: params, 
  });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [summary, page, categoryList] = await Promise.all([
      api.assetStats(),
      api.listAssets({
        page: 1,
        pageSize: 10000, 
      }),
      api.listCategories(),
    ]);

    stats.value = summary;
    assets.value = page.rows;
    categories.value = categoryList;
    await nextTick();
    renderCharts();
  } catch (error) {
    ElMessage.error(errMsg(error));
  } finally {
    loading.value = false;
  }
}

function chartTheme(): {
  text: string;
  muted: string;
  line: string; 
} {
  const style = getComputedStyle(document.documentElement);

  return {
    text: style.getPropertyValue('--app-text').trim() || '#e5e7eb',
    muted: style.getPropertyValue('--app-text2').trim() || '#94a3b8',
    line: style.getPropertyValue('--app-border').trim() || '#334155',
  };
}

function renderCharts(): void {
  if (!statusChartRef.value || !categoryChartRef.value || !conditionChartRef.value) return;
  const theme = chartTheme();

  statusChart ??= echarts.init(statusChartRef.value);
  categoryChart ??= echarts.init(categoryChartRef.value);
  conditionChart ??= echarts.init(conditionChartRef.value);
  statusChart.setOption({
    animationDuration: 700,
    grid: {
      left: 30,
      right: 12,
      top: 24,
      bottom: 28, 
    },
    xAxis: {
      type: 'category',
      data: statusItems.value.map((item) => item.label),
      axisLine: { lineStyle: { color: theme.line } },
      axisLabel: { color: theme.muted }, 
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: theme.line,
          type: 'dashed', 
        }, 
      },
      axisLabel: { color: theme.muted }, 
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }, 
    },
    series: [
      {
        type: 'bar',
        barWidth: 34,
        data: statusItems.value.map((item) => ({
          value: item.value,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: item.tone === 'danger' ? '#fb7185' : item.tone === 'warning' ? '#fbbf24' : item.tone === 'success' ? '#34d399' : '#60a5fa', 
              },
              {
                offset: 1,
                color: item.tone === 'danger' ? '#e11d48' : item.tone === 'warning' ? '#d97706' : item.tone === 'success' ? '#059669' : '#2563eb', 
              },
            ]),
            borderRadius: [6, 6, 0, 0], 
          }, 
        })), 
      },
    ],
  }, true);
  categoryChart.setOption({
    animationDuration: 700,
    title: {
      text: `${trackedAssets.value.length}`,
      subtext: '在管资产',
      left: 'center',
      top: '39%',
      textStyle: {
        color: theme.text,
        fontSize: 24,
        fontWeight: 700, 
      },
      subtextStyle: {
        color: theme.muted,
        fontSize: 12, 
      }, 
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>{c} 台 ({d}%)', 
    },
    legend: {
      bottom: 0,
      textStyle: { color: theme.muted },
      itemWidth: 10,
      itemHeight: 10, 
    },
    series: [
      {
        type: 'pie',
        radius: ['55%', '76%'],
        center: ['50%', '43%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: 'transparent',
          borderWidth: 4,
          borderRadius: 5, 
        },
        label: { show: false },
        data: categoryItems.value.map((item) => ({
          name: item.name,
          value: item.count,
          category: item.value, 
        })), 
      },
    ],
  }, true);
  conditionChart.setOption({
    animationDuration: 700,
    grid: {
      left: 28,
      right: 12,
      top: 20,
      bottom: 28, 
    },
    xAxis: {
      type: 'category',
      data: conditionItems.value.map((item) => String(item.score)),
      name: '成色',
      nameTextStyle: { color: theme.muted },
      axisLine: { lineStyle: { color: theme.line } },
      axisLabel: { color: theme.muted }, 
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: theme.line,
          type: 'dashed', 
        }, 
      },
      axisLabel: { color: theme.muted }, 
    },
    tooltip: { trigger: 'axis' },
    series: [
      {
        type: 'bar',
        barMaxWidth: 42,
        data: conditionItems.value.map((item) => ({
          value: item.count,
          itemStyle: {
            color: item.score <= 5 ? '#f59e0b' : '#38bdf8',
            borderRadius: [5, 5, 0, 0], 
          }, 
        })), 
      },
    ],
  }, true);
  statusChart.off('click').on('click', (params) => {
    const item = statusItems.value[params.dataIndex];

    if (item) openAssets({ status: item.key }); 
  });
  categoryChart.off('click').on('click', (params) => openAssets({ category: (params.data as { category: string }).category }));
  conditionChart.off('click').on('click', (params) => {
    if (Number(params.name) <= 5) openAssets({ condition: 'low' }); 
  });
}

function resizeCharts(): void {
  statusChart?.resize(); categoryChart?.resize(); conditionChart?.resize(); 
}
onMounted(() => {
  window.addEventListener('resize', resizeCharts); void load(); 
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts); statusChart?.dispose(); categoryChart?.dispose(); conditionChart?.dispose(); 
});
</script>

<template>
  <div v-loading="loading">
    <div class="dashboard-head">
      <div>
        <h2 class="page-title">
          仪表盘
        </h2><p class="page-sub">
          资产运营概览与待处理事项
        </p>
      </div>
      <el-button @click="load">
        刷新数据
      </el-button>
    </div>

    <template v-if="stats">
      <div class="metric-grid">
        <button class="metric-card" type="button" @click="openAssets()">
          <span>资产总数</span><b>{{ stats.total }}</b><small>全部资产档案</small>
        </button>
        <button class="metric-card metric-success" type="button" @click="openAssets({ status: 'inuse' })">
          <span>在用资产</span><b>{{ stats.inuse }}</b><small>已分配给员工</small>
        </button>
        <button class="metric-card metric-danger" type="button" @click="openAssets({ status: 'pending_recycle' })">
          <span>待回收</span><b>{{ stats.pendingRecycle }}</b><small>需 IT 确认回收</small>
        </button>
        <button class="metric-card metric-warning" type="button" @click="openAssets({ condition: 'low' })">
          <span>低成色资产</span><b>{{ lowCondition.length }}</b><small>成色 1-5，建议盘点</small>
        </button>
        <div class="metric-card metric-value">
          <span>账面总净值</span><b>{{ fmtMoney(stats.totalNetValue) }}</b><small>按成色实时估值</small>
        </div>
      </div>

      <div class="dashboard-grid">
        <section class="panel chart-panel">
          <div class="panel-head">
            <h3>资产状态</h3><el-button link type="primary" @click="openAssets()">
              查看台账
            </el-button>
          </div>
          <div ref="statusChartRef" class="echart" />
        </section>

        <section class="panel chart-panel">
          <div class="panel-head">
            <h3>资产分类</h3><el-button link type="primary" @click="openAssets()">
              分类筛选
            </el-button>
          </div>
          <div ref="categoryChartRef" class="echart" />
        </section>
      </div>

      <section class="panel chart-panel condition-panel">
        <div class="panel-head">
          <h3>成色分布</h3><span class="panel-note">1 为成色最低，10 为全新</span>
        </div>
        <div ref="conditionChartRef" class="echart condition-echart" />
      </section>

      <div class="dashboard-grid bottom-grid">
        <section class="panel">
          <div class="panel-head">
            <h3>低成色关注</h3><el-button link type="primary" @click="openAssets({ condition: 'low' })">
              查看全部
            </el-button>
          </div>
          <el-table :data="lowCondition.slice(0, 5)" size="small" empty-text="暂无低成色资产">
            <el-table-column prop="asset_no" label="资产编号" min-width="150" />
            <el-table-column label="分类" width="100">
              <template #default="{ row }">
                {{ CATEGORY_LABELS[row.category as keyof typeof CATEGORY_LABELS] || row.category }}
              </template>
            </el-table-column>
            <el-table-column prop="condition_score" label="成色" width="70" align="center" />
            <el-table-column label="操作" width="72">
              <template #default="{ row }">
                <el-button link type="primary" @click="openAssets({ keyword: row.asset_no })">
                  查看
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>最近登记</h3><el-button link type="primary" @click="openAssets()">
              全部资产
            </el-button>
          </div>
          <el-table :data="recentAssets" size="small" empty-text="暂无资产">
            <el-table-column prop="asset_no" label="资产编号" min-width="150" />
            <el-table-column label="状态" width="86">
              <template #default="{ row }">
                <el-tag size="small">
                  {{ STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="净值" width="110" align="right">
              <template #default="{ row }">
                {{ fmtMoney(row.net_value) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="72">
              <template #default="{ row }">
                <el-button link type="primary" @click="openAssets({ keyword: row.asset_no })">
                  查看
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-head,
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}

.metric-card {
  min-height: 116px;
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  text-align: left;
}

.metric-card:not(.metric-value) {
  cursor: pointer;
}

.metric-card span,
.metric-card small {
  display: block;
  color: var(--app-text2);
  font-size: 13px;
}

.metric-card b {
  display: block;
  margin: 10px 0 7px;
  font-size: 26px;
  line-height: 1;
}

.metric-success b {
  color: #10b981;
}

.metric-danger b {
  color: #ef4444;
}

.metric-warning b {
  color: #f59e0b;
}

.metric-value b {
  font-size: 22px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.panel {
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
}

.panel h3 {
  margin: 0;
  font-size: 15px;
}

.distribution-list {
  margin-top: 12px;
}

.distribution-row {
  display: grid;
  grid-template-columns: 78px 1fr 32px;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.bar-track {
  height: 7px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--app-bg);
}

.bar-track i {
  display: block;
  height: 100%;
  border-radius: 4px;
}

.bar-primary {
  background: #409eff;
}

.bar-success {
  background: #10b981;
}

.bar-info {
  background: #64748b;
}

.bar-warning {
  background: #f59e0b;
}

.bar-danger {
  background: #ef4444;
}

.bottom-grid {
  margin-top: 16px;
}

.bottom-grid .panel {
  min-width: 0;
}

@media (width <= 1100px) {
  .metric-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 640px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .metric-value {
    grid-column: span 2;
  }
}

.echart {
  width: 100%;
  height: 184px;
}

.condition-echart {
  height: 154px;
}

.chart-panel {
  min-height: 236px;
}

.column-chart,
.condition-chart {
  display: flex;
  align-items: end;
  gap: 14px;
  height: 170px;
  padding: 12px 6px 0;
}

.chart-column,
.condition-column {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--app-text);
  cursor: pointer;
}

.chart-column b,
.condition-column b {
  height: 18px;
  font-size: 13px;
}

.column-track,
.condition-track {
  display: flex;
  align-items: end;
  width: 100%;
  height: 112px;
  border-bottom: 1px solid var(--app-border);
}

.column-track i,
.condition-track i {
  display: block;
  width: 100%;
  min-height: 3px;
  border-radius: 3px 3px 0 0;
}

.condition-track i {
  background: #409eff;
}

.condition-track i.risk {
  background: #f59e0b;
}

.chart-column span,
.condition-column span {
  color: var(--app-text2);
  font-size: 12px;
  white-space: nowrap;
}

.donut-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  min-height: 170px;
}

.donut-chart {
  width: 150px;
  height: 150px;
  transform: rotate(-90deg);
}

.donut-base,
.donut-segment {
  fill: none;
  stroke-width: 16;
}

.donut-base {
  stroke: var(--app-bg);
}

.donut-segment {
  stroke-linecap: butt;
}

.donut-legend {
  display: grid;
  gap: 8px;
  min-width: 150px;
}

.donut-legend button {
  display: grid;
  grid-template-columns: 10px 1fr 24px;
  gap: 8px;
  align-items: center;
  border: 0;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.donut-legend i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.panel-note {
  color: var(--app-text2);
  font-size: 12px;
}

.condition-panel {
  margin-top: 16px;
  min-height: 224px;
}

@media (width <= 640px) {
  .donut-layout {
    gap: 12px;
  }

  .donut-chart {
    width: 126px;
    height: 126px;
  }

  .donut-legend {
    min-width: 120px;
  }

  .column-chart,
  .condition-chart {
    gap: 7px;
  }
}
</style>
