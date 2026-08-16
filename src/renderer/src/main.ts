import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css' // EP 暗色变量（html.dark 时生效）
import './style.css' // 放在 EP 样式之后：:root 主题变量覆盖才能生效
import App from './App.vue'
import { router } from './router'

createApp(App).use(ElementPlus, { locale: zhCn }).use(router).mount('#app')
