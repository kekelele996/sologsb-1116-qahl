/** 培养管状态 */
export const CULTURE_STATUSES = ['在存', '污染', '废弃'] as const
export type CultureStatus = (typeof CULTURE_STATUSES)[number]

/** 常用培养基（表单中可自行补充其他培养基） */
export const CULTURE_MEDIUMS = [
  'PDA 培养基（马铃薯葡萄糖琼脂）',
  '改良 PDA（加链霉素）',
  'MEA 麦芽浸膏琼脂',
  '综合马铃薯培养基',
  '木屑菌包培养基'
] as const

/** CultureTube 菌种培养管 */
export interface CultureTube {
  id: string
  /** 管号（纸面试管编号，全局唯一） */
  tubeNo: string
  /** 来源菌物条目 */
  recordId: string
  /** 培养基 */
  medium: string
  /** 分离或转接日期 */
  date: string
  /** 代次：起始管为 0（母管 P0），每转接一代 +1 */
  generation: number
  /** 起始管 id（始终指向本支最早的原始来源管） */
  rootId: string
  /** 上一代培养管 id；起始管为 null */
  parentId: string | null
  status: CultureStatus
  note: string
}
