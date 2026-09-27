<script setup lang="ts">
import { computed } from 'vue'
import type { CultureTube } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { recordStore } from '@/stores/recordStore'
import { strainStore } from '@/stores/strainStore'
import { childrenOf, lineageOf, tubeStatusType } from '@/utils/strain'

const props = defineProps<{ tube: CultureTube | null }>()
const visible = defineModel<boolean>({ required: true })

const recordState = useStore(recordStore)
const strainState = useStore(strainStore)

/** 原始来源条目（任何一代都能回溯到同一个来源） */
const source = computed(() => recordState.records.find((item) => item.id === props.tube?.recordId) ?? null)
/** 起始管 → 当前管的历代链 */
const chain = computed(() => (props.tube ? lineageOf(strainState.tubes, props.tube) : []))
const children = computed(() => (props.tube ? childrenOf(strainState.tubes, props.tube.id) : []))
</script>

<template>
  <el-dialog v-model="visible" title="历代关系与原始来源" width="560px">
    <template v-if="tube">
      <el-descriptions :column="2" border size="small" class="source">
        <el-descriptions-item label="来源条目">
          <span v-if="source" class="mono">{{ source.code }}</span>
          <span v-else>条目已删除</span>
        </el-descriptions-item>
        <el-descriptions-item label="暂定名">{{ source?.tempName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="采集日期">{{ source?.collectDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="采集人">{{ source?.collector || '—' }}</el-descriptions-item>
      </el-descriptions>

      <p class="chain-title">传代链（G1 起始管 → 当前管）</p>
      <el-timeline class="chain">
        <el-timeline-item
          v-for="item in chain"
          :key="item.id"
          :timestamp="item.isolateDate"
          :type="item.id === tube.id ? 'primary' : ''"
          :hollow="item.id !== tube.id"
        >
          <div class="chain-line">
            <el-tag size="small" effect="dark" :type="item.id === tube.id ? 'primary' : 'info'">
              G{{ item.generation }}
            </el-tag>
            <span class="mono">{{ item.tubeNo }}</span>
            <span class="muted">{{ item.medium }}</span>
            <el-tag size="small" :type="tubeStatusType(item.status)" effect="plain">{{ item.status }}</el-tag>
            <el-tag v-if="item.id === tube.id" size="small" type="warning" effect="dark">当前管</el-tag>
          </div>
          <p v-if="item.note" class="chain-note">{{ item.note }}</p>
        </el-timeline-item>
      </el-timeline>

      <p class="chain-title">直接子管（{{ children.length }}）</p>
      <div v-if="children.length > 0" class="children">
        <el-tag
          v-for="child in children"
          :key="child.id"
          size="small"
          effect="plain"
          :type="tubeStatusType(child.status)"
        >
          G{{ child.generation }} · {{ child.tubeNo }}
        </el-tag>
      </div>
      <p v-else class="muted">暂无转接子管</p>
    </template>
  </el-dialog>
</template>

<style scoped>
.source {
  margin-bottom: 14px;
}
.chain-title {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 600;
}
.chain {
  padding-left: 4px;
}
.chain-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chain-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6f7d72;
}
.children {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
