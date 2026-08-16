<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useElectron } from '../composables/useElectron';
import { errMsg } from '../utils';
const api = useElectron(); const rows = ref<any[]>([]); const types = ref<any[]>([]); const loading = ref(false); const configRow = ref<any | null>(null); const selected = ref<number[]>([]);
const route = useRoute();

async function load() {
  loading.value = true; try {
    rows.value = await api.listCategories(); types.value = await api.listDeviceTypes(); const id = Number(route.query.categoryId);

    if (id) {
      const row = rows.value.find((x: any) => x.id === id);

      if (row)openConfig(row); 
    } 
  } catch (e) {
    ElMessage.error(errMsg(e)); 
  } finally {
    loading.value = false; 
  } 
}
function openConfig(row: any) {
  configRow.value = row; selected.value = row.device_types.map((x: any) => x.id); 
}
async function addDevice() {
  if (!configRow.value) return; const categoryId = configRow.value.id;

  try {
    const { value } = await ElMessageBox.prompt('设备类型名称', '新增设备类型', {
      confirmButtonText: '新增',
      cancelButtonText: '取消', 
    });

    if (!value?.trim()) return; await api.createDeviceType({
      categoryId,
      name: value.trim(), 
    }); await load(); configRow.value = rows.value.find((x: any) => x.id === categoryId); ElMessage.success('设备类型已新增'); 
  } catch (e) {
    if (e)ElMessage.error(errMsg(e)); 
  } 
}
async function renameDevice(t: any) {
  const { value } = await ElMessageBox.prompt('设备类型名称', '修改设备类型', { inputValue: t.name });

  if (value?.trim()) {
    await api.updateDeviceType(t.id, value.trim()); await load(); configRow.value = rows.value.find((x: any) => x.id === configRow.value.id); 
  } 
}
async function removeDevice(t: any) {
  await ElMessageBox.confirm(`确定删除“${t.name}”？`, '删除确认'); await api.deleteDeviceType(t.id); await load(); configRow.value = rows.value.find((x: any) => x.id === configRow.value.id); 
}
async function saveConfig() {
  if (!configRow.value) return; await api.setCategoryDevices(configRow.value.id, selected.value); configRow.value = null; await load(); ElMessage.success('关联设备类型已保存'); 
}
async function add() {
  const { value } = await ElMessageBox.prompt('分类名称', '新增资产分类');

  if (value?.trim()) {
    await api.createCategory({ name: value.trim() }); await load(); 
  } 
}
async function rename(r: any) {
  const { value } = await ElMessageBox.prompt('分类名称', '修改分类', { inputValue: r.name });

  if (value?.trim()) {
    await api.updateCategory(r.id, value.trim()); await load(); 
  } 
}
async function remove(r: any) {
  if (r.is_preset) return; await ElMessageBox.confirm(`确定删除“${r.name}”？`, '删除确认'); await api.deleteCategory(r.id); await load(); 
}
onMounted(load);
</script>
<template>
  <h2 class="page-title">
    资产分类管理
  </h2><p class="page-sub">
    管理资产分类及其关联设备类型，预置分类不可删除或改名
  </p>
  <el-card shadow="never">
    <template #header>
      <div class="head">
        <span>资产分类</span><el-button type="primary" size="small" @click="add">
          新增分类
        </el-button>
      </div>
    </template>
    <div class="data-table-wrap">
      <el-table v-loading="loading" height="100%" :data="rows" border>
        <el-table-column prop="name" label="分类名称" /><el-table-column prop="value" label="Value" width="180" /><el-table-column label="类型" width="100">
          <template #default="{row}">
            {{ row.is_preset?'预置':'自定义' }}
          </template>
        </el-table-column><el-table-column label="关联设备类型" min-width="220">
          <template #default="{row}">
            {{ row.device_types.map((x:any)=>x.name).join('、')||'未配置' }}
          </template>
        </el-table-column><el-table-column label="操作" width="250">
          <template #default="{row}">
            <el-button link type="primary" @click="openConfig(row)">
              配置设备类型
            </el-button><el-button link :disabled="row.is_preset" @click="rename(row)">
              改名
            </el-button><el-button link type="danger" :disabled="row.is_preset" @click="remove(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-card>
  <el-drawer v-model="configRow" title="配置设备类型" direction="rtl" size="480px" class="device-type-drawer">
    <div class="drawer-subtitle">
      {{ configRow?.name }} <span>设备类型</span>
    </div><el-table :data="configRow?.device_types" border size="small" empty-text="暂无设备类型">
      <el-table-column prop="name" label="设备类型" /><el-table-column label="操作" width="150">
        <template #default="{row}">
          <el-button link @click="renameDevice(row)">
            改名
          </el-button><el-button link type="danger" :disabled="row.is_preset" @click="removeDevice(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table><el-button class="add-device" type="primary" plain @click="addDevice">
      新增设备类型
    </el-button>
  </el-drawer>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.drawer-subtitle {
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}

.drawer-subtitle span {
  margin-left: 8px;
  color: var(--app-text-3);
  font-size: 12px;
  font-weight: 400;
}

.add-device {
  margin-top: 16px;
}
</style>
