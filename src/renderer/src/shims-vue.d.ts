// Vue SFC 的通配模块声明——必须保持"全局声明文件"形态：
// 文件里不能有任何顶层 import/export，否则 .vue 导入解析不到
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;

  export default component;
}
