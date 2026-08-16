<!-- ==================== 资产详情抽屉（台账页/设备总览页复用） ==================== -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useElectron } from '../composables/useElectron';
import { errMsg, fmtMoney } from '../utils';
import { CATEGORY_LABELS, STATUS_LABELS } from '../../../shared/depreciation';
import type { Asset, AssetComponent } from '../../../shared/types';

const props = defineProps<{ assetId: number | null }>();
const emit = defineEmits<{ 'update:assetId': [number | null] }>();

const api = useElectron();
const asset = ref<Asset | null>(null);
const components = ref<AssetComponent[]>([]);
const loading = ref(false);
const categories = ref<any[]>([]);
const deviceTypeLabels = computed<Record<string, string>>(() => Object.fromEntries(categories.value.flatMap((c) => c.device_types.map((t: any) => [t.value, t.name]))));
const hasConfig = computed(() => {
  const a = asset.value;

  return Boolean(a && (a.hostname || a.mac || a.config_cpu || a.config_memory || a.config_disk));
});

const visible = ref(false);

void api.listCategories().then((items) => {
  categories.value = items; 
})
  .catch(() => undefined);
watch(
  () => props.assetId,
  async (id) => {
    visible.value = id != null;
    if (id == null) return;
    loading.value = true;
    try {
      const detail = await api.getAsset(id);

      asset.value = detail.asset;
      components.value = detail.components;
    } catch (e) {
      ElMessage.error(errMsg(e));
    } finally {
      loading.value = false;
    }
  },
);

function onClose(): void {
  emit('update:assetId', null);
}
</script>

<template>
  <el-drawer
    v-model="visible"
    size="560px"
    :title="asset ? `资产详情 · ${asset.asset_no}` : '资产详情'"
    @close="onClose"
  >
    <div v-loading="loading">
      <template v-if="asset">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="资产编号">
            {{ asset.asset_no }}
          </el-descriptions-item>
          <el-descriptions-item label="分类">
            {{ CATEGORY_LABELS[asset.category] }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag size="small">
              {{ STATUS_LABELS[asset.status] }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="归属员工">
            {{ asset.emp_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="部门">
            {{ asset.dept_path || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="存放位置">
            {{ asset.location || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="主机名">
            {{ asset.hostname || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="原值">
            {{ fmtMoney(asset.original_value) }}
          </el-descriptions-item>
          <el-descriptions-item label="成色">
            {{ asset.condition_score ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="当前净值">
            <b style="color: #e6a23c;">{{ fmtMoney(asset.net_value) }}</b>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            {{ asset.remark || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <template v-if="hasConfig">
          <h4 style="margin: 20px 0 8px;">
            配置信息
          </h4>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="设备名称" :span="2">
              {{ asset.hostname || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="MAC 地址">
              {{ asset.mac || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="CPU">
              {{ asset.config_cpu || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="内存">
              {{ asset.config_memory || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="硬盘">
              {{ asset.config_disk || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </template>

        <h4 style="margin: 20px 0 8px;">
          设备清单（{{ components.length }} 行）
        </h4>
        <el-table :data="components" border size="small" empty-text="暂无组件">
          <el-table-column label="类型" width="90">
            <template #default="{ row }">
              {{ deviceTypeLabels[row.comp_type] || row.comp_type }}
            </template>
          </el-table-column>
          <el-table-column prop="brand_model" label="品牌型号" min-width="130" show-overflow-tooltip />
          <el-table-column prop="sn" label="序列号 SN" min-width="120" show-overflow-tooltip />
          <el-table-column prop="spec" label="规格参数" min-width="130" show-overflow-tooltip />
          <el-table-column prop="quantity" label="数量" width="60" />
          <el-table-column label="来源" width="70">
            <template #default="{ row }">
              <el-tag size="small" :type="row.source === 'auto' ? 'success' : 'info'">
                {{ row.source === 'auto' ? '自动' : '手工' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>
