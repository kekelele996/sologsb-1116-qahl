<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CultureTube } from '@/types'
import { CULTURE_MEDIA } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { recordStore } from '@/stores/recordStore'
import { strainStore } from '@/stores/strainStore'
import { suggestTubeNo } from '@/utils/strain'

const props = defineProps<{ parent: CultureTube | null }>()
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const recordState = useStore(recordStore)
const strainState = useStore(strainStore)

const form = reactive({
  tubeNo: '',
  medium: '',
  isolateDate: new Date().toISOString().slice(0, 10),
  note: ''
})

const parentRecord = computed(() => recordState.records.find((item) => item.id === props.parent?.recordId) ?? null)
/** 转接后新管代次：母管代次自动加一 */
const nextGeneration = computed(() => (props.parent ? props.parent.generation + 1 : 1))

watch(visible, (open) => {
  if (!open || !props.parent) return
  form.medium = props.parent.medium
  form.isolateDate = new Date().toISOString().slice(0, 10)
  form.note = ''
  form.tubeNo = parentRecord.value
    ? suggestTubeNo(strainState.tubes, parentRecord.value.code, nextGeneration.value)
    : ''
})

async function submit(): Promise<void> {
  if (!props.parent) return
  const result = await strainStore.getState().transfer(props.parent.id, {
    tubeNo: form.tubeNo,
    medium: form.medium,
    isolateDate: form.isolateDate,
    note: form.note
  })
  if (!result.ok) {
    ElMessage.error(result.reason)
    return
  }
  ElMessage.success(`转接成功：${result.tube.tubeNo}（G${result.tube.generation}）`)
  visible.value = false
  emit('saved')
}
</script>

<template>
  <el-dialog v-model="visible" title="转接新管" width="520px">
    <template v-if="parent">
      <el-alert type="info" :closable="false" class="parent-tip">
        <p>母管：<b class="mono">{{ parent.tubeNo }}</b>（G{{ parent.generation }} · {{ parent.medium }} · {{ parent.isolateDate }}）</p>
        <p>保存后生成 G{{ nextGeneration }} 新管，代次自动加一；母管状态保持不变。</p>
      </el-alert>
      <el-form label-width="92px">
        <el-form-item label="新管号" required>
          <el-input v-model="form.tubeNo" placeholder="全局唯一，如 BHS-2026-001-G2" />
        </el-form-item>
        <el-form-item label="培养基">
          <el-select v-model="form.medium" filterable allow-create default-first-option style="width: 100%">
            <el-option v-for="item in CULTURE_MEDIA" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="转接日期" required>
          <el-date-picker v-model="form.isolateDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="2" placeholder="如 菌丝长势、污染观察" />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存新管</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.parent-tip {
  margin-bottom: 14px;
}
.parent-tip p {
  margin: 2px 0;
  line-height: 1.6;
}
</style>
