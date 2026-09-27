import { createStore } from 'zustand/vanilla'
import type { CultureTube, FungusRecord, TubeStatus } from '@/types'
import { db, syncAll, syncDelete, syncPut } from '@/hooks/usePersistentStore'
import { uid } from '@/utils/id'

export interface TubeInput {
  tubeNo: string
  medium: string
  isolateDate: string
  note: string
}

export type TubeResult = { ok: true; tube: CultureTube } | { ok: false; reason: string }

export interface StrainState {
  tubes: CultureTube[]
  loaded: boolean
  hydrate: () => Promise<void>
  remove: (id: string) => Promise<void>
  removeByRecord: (recordId: string) => Promise<void>
  /** 从条目建立起始管（G1）：分离日期早于采集日期或管号重复时不保存 */
  createInitial: (record: FungusRecord, input: TubeInput) => Promise<TubeResult>
  /** 转接：由在存母管生成新一代管，代次自动加一；已污染或废弃的管不再转接 */
  transfer: (parentId: string, input: TubeInput) => Promise<TubeResult>
  setStatus: (id: string, status: TubeStatus) => Promise<void>
}

/** 管号必填且全局唯一 */
function checkTubeNo(tubes: CultureTube[], tubeNo: string): string | null {
  if (!tubeNo) return '请填写管号'
  if (tubes.some((item) => item.tubeNo === tubeNo)) return `管号「${tubeNo}」已存在，不能重复登记`
  return null
}

export const strainStore = createStore<StrainState>((set, get) => ({
  tubes: [],
  loaded: false,
  hydrate: async () => {
    const tubes = await syncAll<CultureTube>(db.strains)
    tubes.sort((a, b) =>
      `${a.recordId}${String(a.generation).padStart(3, '0')}${a.tubeNo}`.localeCompare(
        `${b.recordId}${String(b.generation).padStart(3, '0')}${b.tubeNo}`,
        'zh-Hans-CN'
      )
    )
    set({ tubes, loaded: true })
  },
  remove: async (id) => {
    await syncDelete<CultureTube>(db.strains, id)
    await get().hydrate()
  },
  removeByRecord: async (recordId) => {
    const targets = get().tubes.filter((item) => item.recordId === recordId)
    await Promise.all(targets.map((item) => syncDelete<CultureTube>(db.strains, item.id)))
    await get().hydrate()
  },
  createInitial: async (record, input) => {
    const tubeNo = input.tubeNo.trim()
    const dup = checkTubeNo(get().tubes, tubeNo)
    if (dup) return { ok: false, reason: dup }
    if (!input.isolateDate) return { ok: false, reason: '请选择分离日期' }
    if (input.isolateDate < record.collectDate) {
      return { ok: false, reason: `分离日期 ${input.isolateDate} 早于采集日期 ${record.collectDate}，不予保存` }
    }
    const tube: CultureTube = {
      id: uid('str'),
      recordId: record.id,
      tubeNo,
      medium: input.medium.trim() || 'PDA',
      isolateDate: input.isolateDate,
      generation: 1,
      parentId: null,
      status: '在存',
      note: input.note.trim()
    }
    await syncPut<CultureTube>(db.strains, tube)
    await get().hydrate()
    return { ok: true, tube }
  },
  transfer: async (parentId, input) => {
    const parent = get().tubes.find((item) => item.id === parentId)
    if (!parent) return { ok: false, reason: '母管不存在，请刷新后重试' }
    if (parent.status !== '在存') {
      return { ok: false, reason: `母管 ${parent.tubeNo} 已${parent.status}，不能再转接` }
    }
    const tubeNo = input.tubeNo.trim()
    const dup = checkTubeNo(get().tubes, tubeNo)
    if (dup) return { ok: false, reason: dup }
    if (!input.isolateDate) return { ok: false, reason: '请选择转接日期' }
    const tube: CultureTube = {
      id: uid('str'),
      recordId: parent.recordId,
      tubeNo,
      medium: input.medium.trim() || parent.medium,
      isolateDate: input.isolateDate,
      generation: parent.generation + 1,
      parentId: parent.id,
      status: '在存',
      note: input.note.trim()
    }
    await syncPut<CultureTube>(db.strains, tube)
    await get().hydrate()
    return { ok: true, tube }
  },
  setStatus: async (id, status) => {
    const tube = get().tubes.find((item) => item.id === id)
    if (!tube) return
    await syncPut<CultureTube>(db.strains, { ...tube, status })
    await get().hydrate()
  }
}))
