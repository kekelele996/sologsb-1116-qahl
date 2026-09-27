import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CultureTube, TubeStatus } from '@/types'
import { strainStore } from '@/stores/strainStore'

/** 菌管操作：转接 / 历代查看 / 状态变更，对话框状态与动作集中管理（菌种页与条目详情共用） */
export function useTubeActions() {
  const transferVisible = ref(false)
  const transferParent = ref<CultureTube | null>(null)
  const lineageVisible = ref(false)
  const lineageTube = ref<CultureTube | null>(null)

  function openTransfer(tube: CultureTube): void {
    if (tube.status !== '在存') {
      ElMessage.warning(`管 ${tube.tubeNo} 已${tube.status}，不能再转接`)
      return
    }
    transferParent.value = tube
    transferVisible.value = true
  }

  function openLineage(tube: CultureTube): void {
    lineageTube.value = tube
    lineageVisible.value = true
  }

  async function markStatus(tube: CultureTube, status: TubeStatus): Promise<void> {
    try {
      await ElMessageBox.confirm(`确认将管 ${tube.tubeNo} 标为「${status}」？`, '状态变更', { type: 'warning' })
    } catch {
      return
    }
    await strainStore.getState().setStatus(tube.id, status)
    ElMessage.success(`管 ${tube.tubeNo} 已标为${status}`)
  }

  return { transferVisible, transferParent, lineageVisible, lineageTube, openTransfer, openLineage, markStatus }
}
