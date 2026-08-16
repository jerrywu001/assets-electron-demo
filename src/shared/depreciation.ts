import type { AssetCategory, AssetStatus, CompType } from './types'

/** 各资产默认成色（10 表示全新）。 */
export const DEFAULT_CONDITION_SCORE = 10

/** 成色估值：当前净值 = 原值 × 成色 / 10，净值保留两位小数。 */
export function calcNetValue(
  originalValue: number | null | undefined,
  conditionScore: number | null | undefined
): number | null {
  if (originalValue == null || conditionScore == null) return null
  const score = Math.min(10, Math.max(1, Math.round(conditionScore)))
  return Math.round(originalValue * score / 10 * 100) / 100
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  PC: '办公电脑',
  NB: '办公电脑',
  MON: '办公电脑',
  SRV: '服务器',
  OTH: '其他'
}

export const STATUS_LABELS: Record<AssetStatus, string> = {
  idle: '闲置',
  inuse: '在用',
  repair: '维修中',
  pending_recycle: '待回收',
  scrapped: '报废'
}

export const COMP_TYPE_LABELS: Record<CompType, string> = {
  host: '主机',
  laptop: '笔记本',
  cpu: 'CPU',
  memory: '内存',
  disk: '硬盘',
  monitor: '显示器',
  psu: '电源',
  kbmouse: '键鼠套装',
  peripheral: '其他外设'
}
