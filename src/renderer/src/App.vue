<!-- ==================== 布局壳：合并式顶栏（无边框）+ 可收起侧栏 + 双主题 ==================== -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import ScreenWatermark from './components/ScreenWatermark.vue'
import { useElectron } from './composables/useElectron'
import { errMsg } from './utils'

const route = useRoute()
const router = useRouter()
const api = useElectron()

// ---- 侧栏收起状态（localStorage 持久化） ----
const collapsed = ref(localStorage.getItem('sidebar-collapsed') === '1')
watch(collapsed, (v) => localStorage.setItem('sidebar-collapsed', v ? '1' : '0'))

// ---- 暗色主题（var(--app-*) 方案：只是 toggle html.dark，颜色全部走 CSS 变量联动） ----
const isDark = ref(localStorage.getItem('app-theme') === 'dark')
watch(
  isDark,
  (v) => {
    document.documentElement.classList.toggle('dark', v)
    localStorage.setItem('app-theme', v ? 'dark' : 'light')
  },
  { immediate: true }
)

// ---- 顶栏菜单动作 ----
async function onFileCommand(cmd: string): Promise<void> {
  if (cmd === 'export') {
    try {
      const file = await api.exportExcel({ page: 1, pageSize: 20 })
      if (file) ElMessageBox.alert(file, '导出成功', { confirmButtonText: '知道了' })
    } catch (e) {
      ElMessage.error(errMsg(e))
    }
  } else if (cmd === 'quit') {
    await api.windowControl('close')
  }
}

function onViewCommand(cmd: string): void {
  if (cmd === 'theme') isDark.value = !isDark.value
  else if (cmd === 'sidebar') collapsed.value = !collapsed.value
  else if (cmd === 'reload') location.reload()
}

function onHelpCommand(cmd: string): void {
  if (cmd === 'about') {
    ElMessageBox.alert(
      'Electron + Vue3 + TypeScript · 组织架构 / 员工 / 资产台账 / 设备总览 / 折旧净值 / 采集联动 / 审计管控',
      '资产台账管理系统 v1.0',
      { confirmButtonText: '知道了' }
    )
  }
}

// heroicons outline 路径（stroke 风格，与 Next.js 官网图标语言一致）
const nav = [
  { path: '/dashboard', label: '仪表盘', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z' },
  { path: '/categories', label: '资产分类管理', icon: 'M4.5 6.75h15M4.5 12h15M4.5 17.25h15' },
  { path: '/assets', label: '资产台账', icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9' },
  { path: '/devices', label: '设备总览', icon: 'M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25' },
  { path: '/employees', label: '员工管理', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
  { path: '/org', label: '组织架构', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
  { path: '/audits', label: '审计日志', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' }
]

const activePath = computed(() => (route.path.startsWith('/assets') ? '/assets' : route.path))

// 主进程推送的管控通知（打印/下载被拦截时）
api.onAuditNotice((msg) => ElMessage.warning(msg))
</script>

<template>
  <ScreenWatermark />
  <div class="flex h-screen flex-col bg-app-bg text-app-text">
    <!-- ===== 合并式顶栏：图标 + 名称 + 菜单 + 窗口控制（整体可拖拽） ===== -->
    <header class="titlebar flex h-10 shrink-0 select-none items-center border-b border-app-border bg-app-surface">
      <!-- 左：字母图标 + 应用名 -->
      <div class="no-drag flex items-center gap-2 pl-3">
        <div class="grid h-5 w-5 place-items-center rounded bg-app-primary text-[10px] font-bold tracking-tight text-app-primary-text">
          AL
        </div>
        <span class="text-[13px] font-semibold tracking-tight">资产台账</span>
      </div>

      <!-- 菜单（文件/视图/帮助） -->
      <nav class="no-drag ml-4 flex items-center gap-0.5 text-[13px]">
        <el-dropdown trigger="click" @command="onFileCommand">
          <span class="menu-item">文件</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="export">导出台账 Excel</el-dropdown-item>
              <el-dropdown-item command="quit" divided>退出</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown trigger="click" @command="onViewCommand">
          <span class="menu-item">视图</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="theme">{{ isDark ? '切换为亮色' : '切换为暗色' }}</el-dropdown-item>
              <el-dropdown-item command="sidebar">{{ collapsed ? '展开侧栏' : '收起侧栏' }}</el-dropdown-item>
              <el-dropdown-item command="reload" divided>重新加载</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown trigger="click" @command="onHelpCommand">
          <span class="menu-item">帮助</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="about">关于</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </nav>

      <!-- 中间拖拽区 -->
      <div class="flex-1" @dblclick="api.windowControl('maximize')" />

      <!-- 右：主题切换 + 窗口控制 -->
      <button class="win-btn no-drag" :title="isDark ? '切换为亮色' : '切换为暗色'" @click="isDark = !isDark">
        <svg v-if="isDark" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
        <svg v-else fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      </button>
      <button class="win-btn no-drag" title="最小化" @click="api.windowControl('minimize')">
        <svg viewBox="0 0 12 12" class="h-3 w-3" stroke="currentColor" stroke-width="1"><line x1="2" y1="6" x2="10" y2="6" /></svg>
      </button>
      <button class="win-btn no-drag" title="最大化/还原" @click="api.windowControl('maximize')">
        <svg viewBox="0 0 12 12" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="1"><rect x="2.5" y="2.5" width="7" height="7" /></svg>
      </button>
      <button class="win-btn win-btn-close no-drag" title="关闭" @click="api.windowControl('close')">
        <svg viewBox="0 0 12 12" class="h-3 w-3" stroke="currentColor" stroke-width="1"><line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" /></svg>
      </button>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- 侧栏：可收起（56px ↔ 224px） -->
      <aside
        class="flex shrink-0 flex-col border-r border-app-border bg-app-surface transition-all duration-200"
        :class="collapsed ? 'w-14' : 'w-56'"
      >
        <nav class="flex-1 space-y-0.5 overflow-y-auto p-2">
          <div v-if="!collapsed" class="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-app-text3">
            工作台
          </div>
          <router-link
            v-for="item in nav"
            :key="item.path"
            :to="item.path"
            :title="collapsed ? item.label : undefined"
            class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm no-underline transition-colors"
            :class="[
              activePath === item.path
                ? 'bg-app-active font-medium text-app-text'
                : 'text-app-text2 hover:bg-app-hover hover:text-app-text',
              collapsed ? 'justify-center px-0' : ''
            ]"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 shrink-0">
              <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
            </svg>
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </router-link>
        </nav>

        <!-- 底部：收起按钮 -->
        <div class="flex items-center justify-center border-t border-app-border p-2">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-md text-app-text3 transition-colors hover:bg-app-hover hover:text-app-text"
            :title="collapsed ? '展开侧栏' : '收起侧栏'"
            @click="collapsed = !collapsed"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4">
              <path v-if="collapsed" stroke-linecap="round" stroke-linejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
      </aside>

      <!-- 主内容区 -->
      <main
        class="flex-1 overflow-y-auto px-8 py-6"
        :class="collapsed ? 'main-collapsed' : 'main-expanded'"
      >
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* 顶栏整体可拖拽（无边框窗口的移动手柄），交互元素用 no-drag 排除 */
.titlebar {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
.menu-item {
  cursor: pointer;
  border-radius: 6px;
  padding: 3px 10px;
  color: var(--app-text-2);
  outline: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.menu-item:hover {
  background: var(--app-hover);
  color: var(--app-text);
}
.win-btn {
  display: flex;
  height: 40px;
  width: 44px;
  align-items: center;
  justify-content: center;
  color: var(--app-text-2);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.win-btn:hover {
  background: var(--app-hover);
  color: var(--app-text);
}
.win-btn-close:hover {
  background: #e81123;
  color: #fff;
}
.main-expanded {
  --sidebar-width: 224px;
}
.main-collapsed {
  --sidebar-width: 56px;
}
</style>
