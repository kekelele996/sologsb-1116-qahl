<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CultureTube, TubeStatus } from '@/types'
import { TUBE_STATUSES } from '@/types'
import InitialTubeDialog from '@/components/strain/InitialTubeDialog.vue'
import TransferDialog from '@/components/strain/TransferDialog.vue'
import LineageDialog from '@/components/strain/LineageDialog.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { useTubeActions } from '@/hooks/useTubeActions'
import { recordStore } from '@/stores/recordStore'
import { strainStore } from '@/stores/strainStore'
import { tubeStatusType } from '@/utils/strain'

const recordState = useStore(recordStore)
const strainState = useStore(strainStore)

const activeStatus = ref<TubeStatus>('在存')
const keyword = ref('')

const counts = computed<Record<TubeStatus, number>>(() => {
  const map: Record<TubeStatus, number> = { 在存: 0, 污染: 0, 废弃: 0 }
  for (const tube of strainState.tubes) map[tube.status] += 1
  return map
})

/** 按状态分栏 + 关键字（管号 / 培养基 / 来源编号或名称）过滤 */
const visible = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return strainState.tubes.filter((tube) => {
    if (tube.status !== activeStatus.value) return false
    if (!text) return true
    const record = recordOf(tube.recordId)
    const haystack = [tube.tubeNo, tube.medium, record?.code ?? '', record?.tempName ?? '']
      .join(' ')
      .toLowerCase()
    return haystack.includes(text)
  })
})

function recordOf(recordId: string) {
  return recordState.records.find((item) => item.id === recordId) ?? null
}

function parentNo(tube: CultureTube): string {
  if (!tube.parentId) return '—'
  return strainState.tubes.find((item) => item.id === tube.parentId)?.tubeNo ?? '（母管已删）'
}

const initialVisible = ref(false)
const { transferVisible, transferParent, lineageVisible, lineageTube, openTransfer, openLineage, markStatus } =
  useTubeActions()
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">菌种保藏</h2>
        <p class="page-sub">
          从条目建立起始管（G1），转接自动生成新一代管；已污染或废弃的管不再转接，原始来源与历代关系可随时回溯。
        </p>
      </div>
      <el-button type="primary" @click="initialVisible = true">
        <el-icon><Plus /></el-icon>建立起始管
      </el-button>
    </div>

    <div class="toolbar">
      <el-radio-group v-model="activeStatus">
        <el-radio-button v-for="status in TUBE_STATUSES" :key="status" :value="status">
          {{ status }} {{ counts[status] }}
        </el-radio-button>
      </el-radio-group>
      <el-input v-model="keyword" placeholder="管号 / 培养基 / 来源编号或名称" clearable style="width: 260px" />
      <el-tag type="info" effect="plain">共 {{ strainState.tubes.length }} 管</el-tag>
    </div>

    <el-card shadow="never" class="tube-card">
      <el-table :data="visible" border stripe>
        <el-table-column label="管号" min-width="180">
          <template #default="{ row }: { row: CultureTube }">
            <span class="mono tube-no">{{ row.tubeNo }}</span>
            <el-tag v-if="row.parentId === null" size="small" effect="plain">起始管</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="代次" width="70" align="center">
          <template #default="{ row }: { row: CultureTube }">G{{ row.generation }}</template>
        </el-table-column>
        <el-table-column prop="medium" label="培养基" width="110" />
        <el-table-column prop="isolateDate" label="分离/转接日期" width="120" />
        <el-table-column label="来源条目" min-width="190">
          <template #default="{ row }: { row: CultureTube }">
            <template v-if="recordOf(row.recordId)">
              <span class="mono">{{ recordOf(row.recordId)?.code }}</span>
              {{ recordOf(row.recordId)?.tempName || '未命名条目' }}
            </template>
            <span v-else class="muted">条目已删除</span>
          </template>
        </el-table-column>
        <el-table-column label="母管" width="150">
          <template #default="{ row }: { row: CultureTube }">
            <span class="mono">{{ parentNo(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }: { row: CultureTube }">
            <el-tag :type="tubeStatusType(row.status)" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }: { row: CultureTube }">
            <el-button v-if="row.status === '在存'" size="small" type="primary" plain @click="openTransfer(row)">
              转接
            </el-button>
            <el-button size="small" @click="openLineage(row)">历代</el-button>
            <template v-if="row.status === '在存'">
              <el-button size="small" type="warning" plain @click="markStatus(row, '污染')">标污染</el-button>
              <el-button size="small" type="danger" plain @click="markStatus(row, '废弃')">标废弃</el-button>
            </template>
            <template v-else>
              <el-button size="small" type="success" plain @click="markStatus(row, '在存')">恢复在存</el-button>
              <el-button v-if="row.status === '污染'" size="small" type="danger" plain @click="markStatus(row, '废弃')">
                标废弃
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="visible.length === 0" :description="`当前没有「${activeStatus}」状态的菌管`" />
    </el-card>

    <InitialTubeDialog v-model="initialVisible" />
    <TransferDialog v-model="transferVisible" :parent="transferParent" />
    <LineageDialog v-model="lineageVisible" :tube="lineageTube" />
  </div>
</template>

<style scoped>
.tube-card {
  border-radius: 12px;
}
.tube-no {
  font-weight: 600;
  margin-right: 6px;
}
</style>
