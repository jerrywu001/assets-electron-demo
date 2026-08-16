<!-- ==================== 资产登记表单（新增/编辑共用） ==================== -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useElectron } from '../composables/useElectron';
import { errMsg, fmtMoney } from '../utils';
import { calcNetValue, DEFAULT_CONDITION_SCORE, STATUS_LABELS } from '../../../shared/depreciation';
import type { AssetCategory, AssetComponent, AssetInput, AssetStatus, CompType, Employee } from '../../../shared/types';

const api = useElectron();
const route = useRoute();
const router = useRouter();
const editId = route.params.id ? Number(route.params.id) : null;

const form = reactive<AssetInput>({
  asset_no: '',
  category: 'PC',
  brand_model: '',
  sn: '',
  employee_id: null,
  status: 'idle',
  location: '',
  hostname: '',
  mac: '',
  config_cpu: '',
  config_memory: '',
  config_disk: '',
  original_value: null,
  condition_score: DEFAULT_CONDITION_SCORE,
  remark: '',
  components: [],
});
const employees = ref<Employee[]>([]);
const categories = ref<any[]>([]);
const saving = ref(false);
const extracting = ref(false);
const configLoaded = ref(false);
const isOfficeComputer = computed(() => form.category === 'PC');
const config = reactive({
  cpu: '',
  memory: '',
  disk: '', 
});

/** 净值实时预览：与主进程入库重算用同一份 shared 纯函数 */
const netValuePreview = ref('-');

watch(
  [() => form.original_value, () => form.condition_score],
  ([originalValue, conditionScore]) => {
    netValuePreview.value = fmtMoney(calcNetValue(originalValue, conditionScore));
  },
  {
    immediate: true,
    flush: 'sync', 
  },
);

// 分类变化：带默认折旧率；新增模式下重新预生成编号
// 分类变化时，新增模式下重新预生成编号。
watch(() => form.category, async (cat) => {
  if (!editId) form.asset_no = await api.nextAssetNo(cat);
});

// 归属员工联动（PRD：选了即"在用"）
watch(() => form.employee_id, (empId) => {
  if (empId && form.status === 'idle') form.status = 'inuse';
});
watch(() => form.status, (s) => {
  if (s === 'idle') form.employee_id = null;
});

const compTypes = computed<[CompType, string][]>(() => {
  const category = categories.value.find((x) => x.value === form.category);

  return (category?.device_types ?? []).map((x: {
    value: CompType;
    name: string; 
  }) => [x.value, x.name]);
});
const hasDeviceTypes = computed(() => compTypes.value.length > 0);

function openCategoryConfig(): void {
  const category = categories.value.find((x) => x.value === form.category);

  if (category) router.push({
    path: '/categories',
    query: { categoryId: String(category.id) }, 
  });
}

async function extractLocal(): Promise<void> {
  if (!isOfficeComputer.value) return;
  try {
    await ElMessageBox.confirm('请确保要登记的设备就是当前设备', '确认获取本机配置', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  extracting.value = true;
  try {
    const info = await api.previewCollect();

    form.hostname = info.hostname;
    form.mac = info.mac;
    config.cpu = `${info.cpu}（${info.cpuCores} 核）`;
    config.memory = `${Math.round(info.memTotalMB / 1024)} GB`;
    config.disk = info.disks.map((d) => `总容量 ${d.sizeGB}GB`).join('；') || '未检测到固定磁盘';
    form.config_cpu = config.cpu;
    form.config_memory = config.memory;
    form.config_disk = config.disk;
    configLoaded.value = true;
    ElMessage.success(`已获取本机配置（${info.hostname}）`);
  } catch (e) {
    ElMessage.error(errMsg(e));
  } finally {
    extracting.value = false;
  }
}

async function copyConfigSummary(): Promise<void> {
  const summary = [`设备名称：${form.hostname || '-'}`, `CPU：${config.cpu || '-'}`, `内存：${config.memory || '-'}`, `硬盘：${config.disk || '-'}`].join('\n');

  try {
    await navigator.clipboard.writeText(summary); ElMessage.success('摘要信息已复制'); 
  } catch (e) {
    ElMessage.error(errMsg(e)); 
  }
}

function addComponent(): void {
  form.components.push({
    comp_type: compTypes.value[0]?.[0] ?? 'host',
    brand_model: '',
    sn: '',
    spec: '',
    quantity: 1,
    source: 'manual',
    remark: '', 
  });
}

function removeComponent(idx: number): void {
  form.components.splice(idx, 1);
}

function moveComponent(idx: number, dir: -1 | 1): void {
  const target = idx + dir;

  if (target < 0 || target >= form.components.length) return;
  const [row] = form.components.splice(idx, 1);

  form.components.splice(target, 0, row);
}

/** 「自动提取本机配置」：调 IPC 采集本机硬件，追加为 auto 清单行 */
async function submit(): Promise<void> {
  if (!form.components.length) {
    ElMessage.warning('设备至少填写一个');
    return;
  }
  if (form.status === 'inuse' && !form.employee_id) {
    ElMessage.warning('状态为"在用"时必须选择归属员工');
    return;
  }
  if (form.status === 'scrapped') {
    try {
      await ElMessageBox.confirm('报废后不可恢复，确定将状态改为"报废"吗？', '报废确认', {
        type: 'warning',
        confirmButtonText: '确认报废',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }
  }
  saving.value = true;
  try {
    // 兼容既有资产主表字段：以第一行设备作为旧字段快照，新数据以设备行管理为准。
    form.brand_model = form.components[0].brand_model;
    form.sn = form.components[0].sn || null;
    if (editId) {
      await api.updateAsset(editId, form);
      ElMessage.success('已保存');
    } else {
      await api.createAsset(form);
      ElMessage.success(`登记成功：${form.asset_no}`);
    }
    router.push('/assets');
  } catch (e) {
    ElMessage.error(errMsg(e));
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  categories.value = await api.listCategories();
  const activeEmployees = await api.listEmployees({
    status: 'active',
    page: 1,
    pageSize: 200, 
  });

  employees.value = activeEmployees.rows;
  if (editId) {
    const { asset, components } = await api.getAsset(editId);

    Object.assign(form, {
      asset_no: asset.asset_no,
      category: asset.category,
      brand_model: asset.brand_model,
      sn: asset.sn,
      employee_id: asset.employee_id,
      status: asset.status,
      location: asset.location,
      hostname: asset.hostname,
      mac: asset.mac,
      config_cpu: asset.config_cpu ?? '',
      config_memory: asset.config_memory ?? '',
      config_disk: asset.config_disk ?? '',
      original_value: asset.original_value,
      condition_score: asset.condition_score ?? DEFAULT_CONDITION_SCORE,
      remark: asset.remark,
      components: components.map((component) => ({ ...component })),
    });
    if (form.components.length === 0 && (asset.brand_model || asset.sn)) {
      form.components.push({
        comp_type: compTypes.value[0]?.[0] ?? 'host',
        brand_model: asset.brand_model ?? '',
        sn: asset.sn ?? '',
        spec: '',
        quantity: 1,
        source: 'manual',
        remark: '',
      });
    } else if (form.components.length > 0) {
      form.components[0].brand_model ||= asset.brand_model ?? '';
      form.components[0].sn ||= asset.sn ?? '';
    }
    config.cpu = asset.config_cpu ?? '';
    config.memory = asset.config_memory ?? '';
    config.disk = asset.config_disk ?? '';
    configLoaded.value = Boolean(config.cpu || config.memory || config.disk);
  } else {
    form.asset_no = await api.nextAssetNo(form.category);
  }
});
</script>

<template>
  <h2 class="page-title">
    {{ editId ? `编辑资产 ${form.asset_no}` : '资产登记' }}
  </h2>
  <p class="page-sub">
    基本信息 / 价值信息 / 设备清单 / 备注，净值按原值和成色实时计算
  </p>

  <el-form class="asset-form" label-width="100px" style="width: 100%; max-width: none;">
    <el-card shadow="never" style="margin-bottom: 16px;">
      <template #header>
        基本信息
      </template>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="资产编号" required>
            <el-input v-model="form.asset_no" placeholder="自动生成，可修改" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="资产分类" required>
            <el-select v-model="form.category" style="width: 100%;">
              <el-option v-for="category in categories" :key="category.value" :label="category.name" :value="category.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="归属员工">
            <el-select v-model="form.employee_id" filterable clearable placeholder="只显示在职员工" style="width: 100%;">
              <el-option
                v-for="e in employees" :key="e.id"
                :label="`${e.name}（${e.dept_path}）`" :value="e.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态" required>
            <el-select v-model="form.status" style="width: 100%;">
              <el-option
                v-for="(label, key) in STATUS_LABELS" :key="key" :label="label" :value="key"
                :disabled="key === 'pending_recycle'"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="存放位置">
            <el-input v-model="form.location" placeholder="如 3F-A区-012" />
          </el-form-item>
        </el-col>
      </el-row>
    </el-card>

    <el-card v-if="isOfficeComputer" shadow="never" style="margin-bottom: 16px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>配置信息</span>
          <div class="config-actions">
            <el-tooltip v-if="configLoaded" content="复制后可填入设备清单" placement="top">
              <el-button size="small" @click="copyConfigSummary">
                复制摘要信息
              </el-button>
            </el-tooltip><el-button size="small" type="success" :loading="extracting" @click="extractLocal">
              自动获取本机配置
            </el-button>
          </div>
        </div>
      </template>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="设备名称">
            <el-input v-model="form.hostname" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="MAC 地址">
            <el-input v-model="form.mac" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="CPU">
            <el-input v-model="config.cpu" readonly />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="内存">
            <el-input v-model="config.memory" readonly />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="硬盘">
            <el-input v-model="config.disk" readonly />
          </el-form-item>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" style="margin-bottom: 16px;">
      <template #header>
        价值信息
      </template>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="原值（元）">
            <el-input-number v-model="form.original_value" :min="0" :precision="2" style="width: 100%;" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="成色">
            <el-input-number v-model="form.condition_score" :min="1" :max="10" :step="1" :precision="0" style="width: 100%;" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="当前净值">
            <el-input :model-value="netValuePreview" readonly>
              <template #append>
                实时计算
              </template>
            </el-input>
          </el-form-item>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" style="margin-bottom: 16px;">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>设备清单</span>
          <div v-if="hasDeviceTypes">
            <el-button size="small" type="primary" @click="addComponent">
              新增行
            </el-button>
          </div>
        </div>
      </template>
      <div v-if="hasDeviceTypes">
        <el-table :data="form.components" border size="small" empty-text="点击「新增行」填写设备清单">
          <el-table-column label="设备类型" width="130">
            <template #default="{ row }">
              <el-select v-model="row.comp_type" size="small">
                <el-option v-for="[key, label] in compTypes" :key="key" :label="label" :value="key" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="品牌型号" min-width="170">
            <template #default="{ row }">
              <el-input v-model="row.brand_model" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="序列号 SN" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.sn" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="规格参数" min-width="170">
            <template #default="{ row }">
              <el-input v-model="row.spec" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="90">
            <template #default="{ row }">
              <el-input-number v-model="row.quantity" :min="1" size="small" style="width: 100%;" />
            </template>
          </el-table-column>
          <el-table-column label="备注" width="120">
            <template #default="{ row }">
              <el-input v-model="row.remark" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="来源" width="70">
            <template #default="{ row }">
              <el-tag size="small" :type="row.source === 'auto' ? 'success' : 'info'">
                {{ row.source === 'auto' ? '自动' : '手工' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="112" align="center">
            <template #default="{ $index }">
              <el-tooltip content="上移" placement="top">
                <el-button link size="small" aria-label="上移" @click="moveComponent($index, -1)">
                  ↑
                </el-button>
              </el-tooltip>
              <el-tooltip content="下移" placement="top">
                <el-button link size="small" aria-label="下移" @click="moveComponent($index, 1)">
                  ↓
                </el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button link size="small" type="danger" aria-label="删除" @click="removeComponent($index)">
                  ×
                </el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="当前资产分类尚未关联设备类型">
        <template #default>
          <el-button type="primary" @click="openCategoryConfig">
            去资产分类管理关联
          </el-button>
        </template>
      </el-empty>
    </el-card>

    <el-card shadow="never" style="margin-bottom: 16px;">
      <template #header>
        备注
      </template>
      <el-input v-model="form.remark" type="textarea" :rows="3" />
    </el-card>

    <el-form-item class="asset-form-actions">
      <el-button type="primary" :loading="saving" @click="submit">
        {{ editId ? '保存' : '登记' }}
      </el-button>
      <el-button @click="router.push('/assets')">
        返回台账
      </el-button>
    </el-form-item>
  </el-form>
</template>

<style scoped>
.asset-form {
  padding-bottom: 88px;
}

.asset-form-actions {
  position: fixed;
  left: var(--sidebar-width, 224px);
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  justify-content: flex-end;
  margin: 0;
  padding: 14px 32px;
  border-top: 1px solid var(--app-border);
  background: var(--app-bg);
}

.asset-form-actions :deep(.el-form-item__content) {
  justify-content: flex-end;
  width: 100%;
  margin-left: 0 !important;
}
</style>
