// ==================== 渲染层路由 ====================
// hash 模式：生产环境是 file:// 协议，history 路由刷新会 404
import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import('./views/Dashboard.vue'), meta: { title: '仪表盘' } },
    { path: '/assets', component: () => import('./views/Assets.vue'), meta: { title: '资产台账' } },
    { path: '/assets/new', component: () => import('./views/AssetForm.vue'), meta: { title: '资产登记' } },
    { path: '/assets/:id', component: () => import('./views/AssetForm.vue'), meta: { title: '编辑资产' } },
    { path: '/devices', component: () => import('./views/Devices.vue'), meta: { title: '设备总览' } },
    { path: '/employees', component: () => import('./views/Employees.vue'), meta: { title: '员工管理' } },
    { path: '/org', component: () => import('./views/Org.vue'), meta: { title: '组织架构' } },
    { path: '/categories', component: () => import('./views/Categories.vue'), meta: { title: '资产分类管理' } },
    { path: '/audits', component: () => import('./views/Audits.vue'), meta: { title: '审计日志' } }
  ]
})
