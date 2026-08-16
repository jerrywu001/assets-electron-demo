<!-- ==================== 屏幕水印组件 ==================== -->
<!-- 对应 JD 职责：水印防拍照泄密。Canvas 平铺工号+姓名+日期 -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue';

const canvasRef = useTemplateRef<HTMLCanvasElement>('wm');

// 真实项目：内容 = 当前登录人工号 + 姓名 + 时间，登录后从 SSO 拿
const text = `张三 工号10086 ${new Date().toLocaleDateString()}`;

function draw(): void {
  const canvas = canvasRef.value;

  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext('2d');

  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.font = '14px system-ui';
  ctx.fillStyle = '#555';
  ctx.textAlign = 'center';
  for (let y = 60; y < window.innerHeight; y += 160) {
    for (let x = 120; x < window.innerWidth; x += 320) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 12);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }
}

onMounted(() => {
  window.addEventListener('resize', draw);
  draw();
});
onBeforeUnmount(() => window.removeEventListener('resize', draw));
</script>

<template>
  <canvas ref="wm" class="watermark" />
</template>

<style scoped>
.watermark {
  position: fixed;
  inset: 0;
  pointer-events: none; /* 不挡鼠标操作 */
  z-index: 50;
  opacity: 0.12;
}
</style>
