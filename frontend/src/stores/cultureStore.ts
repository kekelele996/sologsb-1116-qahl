import { createStore } from 'zustand/vanilla'
import type { CultureStatus, CultureTube, FungusRecord } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { uid } from '@/utils/id'

/** 建立起始管入参 */
export interface StarterInput {
  tubeNo: string
  recordId: string
  medium: string
  date: string
  note: string
}

/** 转接入参 */
export interface TransferInput {
  tubeNo: string
  medium: string
  date: string
  note: string
}

export interface CultureSaveResult {
  ok: boolean
  message: string
}

/** 单条目培养管统计 */
export interface CultureStat {
  /** 管总数（含污染、废弃） */
  total: number
  /** 当前在存管数 */
  active: number
  /** 最高代次（P0 起始；无管时为 null） */
  maxGeneration: number | null
}

function emptyStat(): CultureStat {
  return { total: 0, active: 0, maxGeneration: null }
}

/** 由培养管列表汇总管数与最高代次（纯函数，页面与详情共用） */
export function summarizeCultures(tubes: CultureTube[]): CultureStat {
  if (tubes.length === 0) return emptyStat()
  return {
    total: tubes.length,
    active: tubes.filter((tube) => tube.status === '在存').length,
    maxGeneration: tubes.reduce((max, tube) => Math.max(max, tube.generation), 0)
  }
}

export interface CultureState {
  cultures: CultureTube[]
  loaded: boolean
  hydrate: () => Promise<void>
  /** 从已有条目建立起始管（P0）；日期早于采集日期或管号重复则不保存 */
  createStarter: (input: StarterInput, record: FungusRecord | undefined) => Promise<CultureSaveResult>
  /** 由上一代管转接生成新管，代次自动 +1；污染/废弃管不再转接 */
  transfer: (parentId: string, input: TransferInput) => Promise<CultureSaveResult>
  markStatus: (id: string, status: CultureStatus) => Promise<void>
  removeByRecord: (recordId: string) => Promise<void>
  /** 历代关系：从原始来源管到当前管的完整链路 */
  lineageOf: (tubeId: string) => CultureTube[]
  statOf: (recordId: string) => CultureStat
}

export const cultureStore = createStore<CultureState>((set, get) => ({
  cultures: [],
  loaded: false,
  hydrate: async () => {
    const cultures = await syncAll<CultureTube>(db.cultures)
    cultures.sort((a, b) => (a.date + a.tubeNo).localeCompare(b.date + b.tubeNo))
    set({ cultures, loaded: true })
  },

  createStarter: async (input, record) => {
    const tubeNo = input.tubeNo.trim()
    const medium = input.medium.trim()
    if (!tubeNo) return { ok: false, message: '请填写培养管管号' }
    if (!medium) return { ok: false, message: '请填写培养基' }
    if (!input.date) return { ok: false, message: '请选择分离日期' }
    if (!record) return { ok: false, message: '请选择来源条目' }
    // 管号全局唯一（纸面编号即主键，重复不保存）
    if (get().cultures.some((tube) => tube.tubeNo === tubeNo)) {
      return { ok: false, message: `管号「${tubeNo}」已登记，请核对纸面编号` }
    }
    // 分离日期不能早于采集日期
    if (input.date < record.collectDate) {
      return { ok: false, message: `分离日期不能早于采集日期（${record.collectDate}）` }
    }
    const tube: CultureTube = {
      id: uid('cul'),
      tubeNo,
      recordId: record.id,
      medium,
      date: input.date,
      generation: 0,
      rootId: '',
      parentId: null,
      status: '在存',
      note: input.note.trim()
    }
    tube.rootId = tube.id
    await syncPut<CultureTube>(db.cultures, tube)
    await get().hydrate()
    return { ok: true, message: `起始管 ${tubeNo}（P0）已建立` }
  },

  transfer: async (parentId, input) => {
    const parent = get().cultures.find((tube) => tube.id === parentId)
    const tubeNo = input.tubeNo.trim()
    const medium = input.medium.trim()
    if (!parent) return { ok: false, message: '未找到上一代培养管' }
    // 已污染或废弃的管不再转接
    if (parent.status !== '在存') {
      return { ok: false, message: `母管「${parent.tubeNo}」已${parent.status}，不能再转接` }
    }
    if (!tubeNo) return { ok: false, message: '请填写新培养管管号' }
    if (!medium) return { ok: false, message: '请填写培养基' }
    if (!input.date) return { ok: false, message: '请选择转接日期' }
    if (get().cultures.some((tube) => tube.tubeNo === tubeNo)) {
      return { ok: false, message: `管号「${tubeNo}」已登记，请核对纸面编号` }
    }
    // 转接日期不应早于母管分离/转接日期
    if (input.date < parent.date) {
      return { ok: false, message: `转接日期不能早于母管日期（${parent.date}）` }
    }
    const tube: CultureTube = {
      id: uid('cul'),
      tubeNo,
      recordId: parent.recordId,
      medium,
      date: input.date,
      generation: parent.generation + 1,
      rootId: parent.rootId,
      parentId: parent.id,
      status: '在存',
      note: input.note.trim()
    }
    await syncPut<CultureTube>(db.cultures, tube)
    await get().hydrate()
    return { ok: true, message: `转接完成：新管 ${tubeNo}（P${tube.generation}）` }
  },

  markStatus: async (id, status) => {
    const tube = get().cultures.find((item) => item.id === id)
    if (!tube || tube.status === status) return
    await syncPut<CultureTube>(db.cultures, { ...tube, status })
    await get().hydrate()
  },

  removeByRecord: async (recordId) => {
    const targets = get().cultures.filter((tube) => tube.recordId === recordId)
    await Promise.all(targets.map((tube) => syncDelete<CultureTube>(db.cultures, tube.id)))
    await get().hydrate()
  },

  lineageOf: (tubeId) => {
    const all = get().cultures
    const byId = new Map(all.map((tube) => [tube.id, tube]))
    const chain: CultureTube[] = []
    let current = byId.get(tubeId)
    while (current) {
      chain.unshift(current)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return chain
  },

  statOf: (recordId) => summarizeCultures(get().cultures.filter((tube) => tube.recordId === recordId))
}))
