import type { CultureTube, TubeStatus } from '@/types'

/** 从起始管到当前管的历代链（含自身，按代次升序；母管缺失时到此为止） */
export function lineageOf(tubes: CultureTube[], tube: CultureTube): CultureTube[] {
  const chain: CultureTube[] = []
  const guard = new Set<string>()
  let current: CultureTube | undefined = tube
  while (current && !guard.has(current.id)) {
    guard.add(current.id)
    chain.unshift(current)
    const parentId: string | null = current.parentId
    current = parentId ? tubes.find((item) => item.id === parentId) : undefined
  }
  return chain
}

/** 直接子管（按管号排序） */
export function childrenOf(tubes: CultureTube[], id: string): CultureTube[] {
  return tubes
    .filter((item) => item.parentId === id)
    .sort((a, b) => a.tubeNo.localeCompare(b.tubeNo, 'zh-Hans-CN'))
}

/** 条目维度的保藏统计：当前管数 / 在存管数 / 最高代次 */
export function strainStats(
  tubes: CultureTube[],
  recordId: string
): { total: number; active: number; maxGeneration: number } {
  const list = tubes.filter((item) => item.recordId === recordId)
  return {
    total: list.length,
    active: list.filter((item) => item.status === '在存').length,
    maxGeneration: list.reduce((max, item) => Math.max(max, item.generation), 0)
  }
}

/** 建议管号：条目编号-G代次，冲突时追加 -2、-3… */
export function suggestTubeNo(tubes: CultureTube[], recordCode: string, generation: number): string {
  const base = `${recordCode}-G${generation}`
  if (!tubes.some((item) => item.tubeNo === base)) return base
  let suffix = 2
  while (tubes.some((item) => item.tubeNo === `${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

/** 状态对应的标签颜色 */
export function tubeStatusType(status: TubeStatus): 'success' | 'danger' | 'info' {
  if (status === '在存') return 'success'
  if (status === '污染') return 'danger'
  return 'info'
}
