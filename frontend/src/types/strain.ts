/** 菌种管状态 */
export const TUBE_STATUSES = ['在存', '污染', '废弃'] as const
export type TubeStatus = (typeof TUBE_STATUSES)[number]

/** 常用培养基（登记时也可自定义新名称） */
export const CULTURE_MEDIA = ['PDA', 'MEA', 'YM', 'PDA综合', '木屑麸皮', '麦麸琼脂'] as const

/** CultureTube 菌种保藏管 */
export interface CultureTube {
  id: string
  /** 来源条目 id */
  recordId: string
  /** 管号（全局唯一） */
  tubeNo: string
  /** 培养基 */
  medium: string
  /** 分离 / 转接日期 */
  isolateDate: string
  /** 代次：起始管为 1，每转接一次加一 */
  generation: number
  /** 母管 id，起始管为 null */
  parentId: string | null
  status: TubeStatus
  /** 状态与培养备注 */
  note: string
}
