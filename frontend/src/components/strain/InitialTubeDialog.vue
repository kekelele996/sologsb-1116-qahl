<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FungusRecord } from '@/types'
import { CULTURE_MEDIA } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { recordStore } from '@/stores/recordStore'
import { strainStore } from '@/stores/strainStore'
import { suggestTubeNo } from '@/utils/strain'

/** 传入 recordId 时锁定来源条目（条目详情页），否则可下拉选择（菌种页） */
const props = defineProps<{ recordId?: string }>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const recordState = useStore(recordStore)
const strainState = useStore(strainStore)

const form = reactive({
  recordId: '',
  tubeNo: '',
  medium: 'PDA',
  isolateDate: new Date().toISOString().slice(0, 10),
  note: ''
})

const fixedRecord = computed(() => recordState.records.find((item) => item.id === props.recordId) ?? null)
const currentRecord = computed<FungusRecord | null>(
  () => fixedRecord.value ?? recordState.records.find((item) => item.id === form.recordId) ?? null
)

watch(visible, (open) => {
  if (!open) return
  form.recordId = props.recordId ?? recordState.records[0]?.id ?? ''
  form.medium = 'PDA'
  form.isolateDate = new Date().toISOString().slice(0, 10)
  form.note = ''
  refreshTubeNo()
})

watch(
  () => form.recordId,
  () => refreshTubeNo()
)

function refreshTubeNo(): void {
  const record = currentRecord.value
  form.tubeNo = record ? suggestTubeNo(strainState.tubes, record.code, 1) : ''
}

/** 分离日期不得早于来源条目的采集日期 */
function beforeCollect(date: Date): boolean {
  const record = currentRecord.value
  if (!record) return false
  return date.getTime() < new Date(`${record.collectDate}T00:00:00`).getTime()
}

async function submit(): Promise<void> {
  const record = currentRecord.value
  if (!record) {
    ElMessage.warning('请选择来源条目')
    return
  }
  const result = await strainStore.getState().createInitial(record, {
    tubeNo: form.tubeNo,
    medium: form.medium,
    isolateDate: form.isolateDate,
    note: form.note
  })
  if (!result.ok) {
    ElMessage.error(result.reason)
    return
  }
  ElMessage.success(`起始管 ${result.tube.tubeNo} 已登记（G1）`)
  visible.value = false
  emit('saved')
}
</script>

<template>
  <el-dialog v-model="visible" title="建立起始管（G1）" width="520px">
    <el-form label-width="92px">
      <el-form-item label="来源条目" required>
        <el-select v-model="form.recordId" :disabled="!!fixedRecord" style="width: 100%">
          <el-option
            v-for="item in recordState.records"
            :key="item.id"
            :label="`${item.code} · ${item.tempName || '未命名条目'}`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="管号" required>
        <el-input v-model="form.tubeNo" placeholder="全局唯一，建议 条目编号-G1" />
      </el-form-item>
      <el-form-item label="培养基">
        <el-select v-model="form.medium" filterable allow-create default-first-option style="width: 100%">
          <el-option v-for="item in CULTURE_MEDIA" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="分离日期" required>
        <el-date-picker
          v-model="form.isolateDate"
          type="date"
          value-format="YYYY-MM-DD"
          :disabled-date="beforeCollect"
          style="width: 100%"
        />
        <p v-if="currentRecord" class="hint">采集日期 {{ currentRecord.collectDate }}，分离日期早于该日不予保存</p>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.note" type="textarea" :rows="2" placeholder="如 孢子印悬液划线分离" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存起始管</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #7f8d82;
  line-height: 1.5;
}
</style>
