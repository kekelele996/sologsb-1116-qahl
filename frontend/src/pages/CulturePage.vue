<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CultureStatus, CultureTube } from '@/types'
import { CULTURE_MEDIUMS, CULTURE_STATUSES } from '@/types'
import { useStore } from '@/hooks/usePersistentStore'
import { cultureStore } from '@/stores/cultureStore'
import { recordStore } from '@/stores/recordStore'

const route = useRoute()
const cultureState = useStore(cultureStore)
const recordState = useStore(recordStore)

const statusTab = ref<CultureStatus>('在存')
const keyword = ref('')
const recordFilter = ref('')
const mediumFilter = ref('')

function recordName(recordId: string): string {
  const record = recordState.records.find((item) => item.id === recordId)
  return record ? `${record.code} · ${record.tempName || '未命名条目'}` : '条目已删除'
}

/** 各状态管数（状态页签角标） */
const statusCounts = computed<Record<CultureStatus, number>>(() => {
  const counts: Record<CultureStatus, number> = { 在存: 0, 污染: 0, 废弃: 0 }
  for (const tube of cultureState.cultures) counts[tube.status] += 1
  return counts
})

/** 培养基下拉：常用培养基 + 已登记培养基去重 */
const mediumOptions = computed<string[]>(() => {
  const used = cultureState.cultures.map((tube) => tube.medium)
  return Array.from(new Set([...CULTURE_MEDIUMS, ...used]))
})

const visible = computed<CultureTube[]>(() => {
  const text = keyword.value.trim().toLowerCase()
  return cultureState.cultures.filter((tube) => {
    if (tube.status !== statusTab.value) return false
    if (recordFilter.value && tube.recordId !== recordFilter.value) return false
    if (mediumFilter.value && tube.medium !== mediumFilter.value) return false
    if (text) {
      const record = recordState.records.find((item) => item.id === tube.recordId)
      const haystack = [
        tube.tubeNo,
        tube.medium,
        tube.note,
        record?.code ?? '',
        record?.tempName ?? ''
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(text)) return false
    }
    return true
  })
})

/* ---------- 建立起始管 ---------- */
const starterVisible = ref(false)
const starterForm = reactive<{ tubeNo: string; recordId: string; medium: string; date: string; note: string }>({
  tubeNo: '',
  recordId: '',
  medium: CULTURE_MEDIUMS[0],
  date: new Date().toISOString().slice(0, 10),
  note: ''
})

const starterRecord = computed(() => recordState.records.find((item) => item.id === starterForm.recordId))

watch(
  () => [cultureState.loaded, recordState.loaded, route.query] as const,
  () => {
    const queryRecordId = typeof route.query.recordId === 'string' ? route.query.recordId : ''
    if (queryRecordId) {
      recordFilter.value = queryRecordId
      if (route.query.action === 'starter') {
        openStarter(queryRecordId)
      }
    }
  },
  { immediate: true }
)

function suggestStarterNo(): string {
  const record = starterRecord.value
  if (!record) return ''
  const seq = cultureState.cultures.filter((tube) => tube.recordId === record.id).length
  return seq === 0 ? `${record.code}-P0` : ''
}

function openStarter(preselectRecordId = ''): void {
  starterForm.tubeNo = ''
  starterForm.recordId = preselectRecordId || recordFilter.value || recordState.records[0]?.id || ''
  starterForm.medium = CULTURE_MEDIUMS[0]
  starterForm.date = new Date().toISOString().slice(0, 10)
  starterForm.note = ''
  starterVisible.value = true
}

watch(
  () => starterForm.recordId,
  () => {
    if (!starterForm.tubeNo) starterForm.tubeNo = suggestStarterNo()
  }
)

async function submitStarter(): Promise<void> {
  const result = await cultureStore.getState().createStarter(
    {
      tubeNo: starterForm.tubeNo,
      recordId: starterForm.recordId,
      medium: starterForm.medium,
      date: starterForm.date,
      note: starterForm.note
    },
    starterRecord.value
  )
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  starterVisible.value = false
  recordFilter.value = starterForm.recordId
  statusTab.value = '在存'
  ElMessage.success(result.message)
}

/* ---------- 转接 ---------- */
const transferVisible = ref(false)
const transferParentId = ref('')
const transferParent = computed(
  () => cultureState.cultures.find((tube) => tube.id === transferParentId.value) ?? null
)
const transferForm = reactive<{ tubeNo: string; medium: string; date: string; note: string }>({
  tubeNo: '',
  medium: CULTURE_MEDIUMS[0],
  date: new Date().toISOString().slice(0, 10),
  note: ''
})

/** 管号续代建议：BHS-001-P1 → BHS-001-P2 */
function nextTubeNo(parent: CultureTube): string {
  const gen = parent.generation + 1
  const replaced = parent.tubeNo.replace(/[Pp]\d+$/, `P${gen}`)
  return replaced === parent.tubeNo ? `${parent.tubeNo}-P${gen}` : replaced
}

function openTransfer(tube: CultureTube): void {
  if (tube.status !== '在存') {
    ElMessage.warning(`「${tube.tubeNo}」已${tube.status}，不能再转接`)
    return
  }
  transferParentId.value = tube.id
  transferForm.tubeNo = nextTubeNo(tube)
  transferForm.medium = tube.medium
  transferForm.date = new Date().toISOString().slice(0, 10)
  transferForm.note = ''
  transferVisible.value = true
}

async function submitTransfer(): Promise<void> {
  const result = await cultureStore
    .getState()
    .transfer(transferParentId.value, { ...transferForm })
  if (!result.ok) {
    ElMessage.warning(result.message)
    return
  }
  transferVisible.value = false
  statusTab.value = '在存'
  ElMessage.success(result.message)
}

/* ---------- 状态变更 ---------- */
async function changeStatus(tube: CultureTube, status: CultureStatus): Promise<void> {
  if (tube.status === status) return
  const verb = status === '在存' ? '恢复为在存' : `标记为${status}`
  await ElMessageBox.confirm(`确认将管「${tube.tubeNo}」${verb}？${status !== '在存' ? '该管将不能再转接。' : ''}`, '状态确认', {
    type: 'warning'
  })
  await cultureStore.getState().markStatus(tube.id, status)
  ElMessage.success(`管「${tube.tubeNo}」已${status === '在存' ? '恢复在存' : status}`)
}

function statusTagType(status: CultureStatus): 'success' | 'danger' | 'info' {
  return status === '在存' ? 'success' : status === '污染' ? 'danger' : 'info'
}

function genTagType(generation: number): 'warning' | 'primary' | 'danger' | 'info' {
  if (generation === 0) return 'warning'
  return generation >= 3 ? 'danger' : 'primary'
}

/** 展开行：原始来源到当前管的历代关系链 */
function lineage(tube: CultureTube): CultureTube[] {
  return cultureStore.getState().lineageOf(tube.id)
}

function resetFilters(): void {
  keyword.value = ''
  recordFilter.value = ''
  mediumFilter.value = ''
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2 class="page-title">菌种保藏</h2>
        <p class="page-sub">
          从图谱条目建立起始管（母管 P0），登记管号、培养基与分离日期；每次转接代次自动 +1，污染/废弃管不再转接，原始来源与历代关系可逐管追溯。
        </p>
      </div>
      <el-button type="primary" @click="openStarter()">
        <el-icon><Plus /></el-icon>建立起始管
      </el-button>
    </div>

    <div class="toolbar">
      <el-radio-group v-model="statusTab">
        <el-radio-button v-for="status in CULTURE_STATUSES" :key="status" :value="status">
          {{ status }}（{{ statusCounts[status] }}）
        </el-radio-button>
      </el-radio-group>
      <el-select v-model="recordFilter" placeholder="全部条目" clearable filterable style="width: 240px">
        <el-option
          v-for="record in recordState.records"
          :key="record.id"
          :label="`${record.code} · ${record.tempName || '未命名条目'}`"
          :value="record.id"
        />
      </el-select>
      <el-select v-model="mediumFilter" placeholder="全部培养基" clearable filterable style="width: 240px">
        <el-option v-for="medium in mediumOptions" :key="medium" :label="medium" :value="medium" />
      </el-select>
      <el-input v-model="keyword" placeholder="管号 / 培养基 / 编号 / 暂定名 / 备注" clearable style="width: 280px" />
      <el-button v-if="recordFilter || mediumFilter || keyword" @click="resetFilters">清空条件</el-button>
    </div>

    <el-card shadow="never" class="table-card">
      <el-table :data="visible" border stripe row-key="id" :default-expand-all="false">
        <el-table-column type="expand">
          <template #default="{ row }: { row: CultureTube }">
            <div class="lineage-box">
              <div class="lineage-chain">
                <template v-for="(tube, index) in lineage(row)" :key="tube.id">
                  <el-tag
                    :type="statusTagType(tube.status)"
                    size="small"
                    :effect="tube.id === row.id ? 'dark' : 'plain'"
                  >
                    {{ tube.tubeNo }} · P{{ tube.generation }}
                  </el-tag>
                  <span v-if="index === 0" class="lineage-root">原始来源</span>
                  <el-icon v-if="index < lineage(row).length - 1" class="lineage-arrow"><ArrowRight /></el-icon>
                </template>
              </div>
              <p class="lineage-meta">
                培养基：{{ row.medium }} · {{ row.date }}
                <template v-if="row.parentId">
                  · 母管 {{ cultureState.cultures.find((t) => t.id === row.parentId)?.tubeNo ?? '已删除' }}
                </template>
                <template v-else> · 由孢子印直接分离</template>
              </p>
              <p v-if="row.note" class="lineage-note">备注：{{ row.note }}</p>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="tubeNo" label="管号" width="170">
          <template #default="{ row }: { row: CultureTube }">
            <span class="mono">{{ row.tubeNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="来源条目" min-width="200">
          <template #default="{ row }: { row: CultureTube }">
            <router-link class="rec-link" :to="`/atlas/${row.recordId}`">{{ recordName(row.recordId) }}</router-link>
          </template>
        </el-table-column>
        <el-table-column prop="medium" label="培养基" min-width="200" show-overflow-tooltip />
        <el-table-column label="代次" width="90" align="center">
          <template #default="{ row }: { row: CultureTube }">
            <el-tag :type="genTagType(row.generation)" size="small" effect="plain">P{{ row.generation }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="date" label="分离/转接日期" width="130" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }: { row: CultureTube }">
            <el-tag :type="statusTagType(row.status)" size="small" effect="dark">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }: { row: CultureTube }">
            <el-button size="small" type="primary" :disabled="row.status !== '在存'" @click="openTransfer(row)">
              转接
            </el-button>
            <el-dropdown v-if="row.status === '在存'" trigger="click" @command="(status: CultureStatus) => changeStatus(row, status)">
              <el-button size="small" plain>标记<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="污染">标记污染</el-dropdown-item>
                  <el-dropdown-item command="废弃">标记废弃</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button v-else size="small" plain @click="changeStatus(row, '在存')">恢复在存</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="`暂无${statusTab}培养管，可从图谱条目详情或本页「建立起始管」开始登记`" />
        </template>
      </el-table>
    </el-card>

    <!-- 建立起始管 -->
    <el-dialog v-model="starterVisible" title="建立起始管（母管 P0）" width="560px">
      <el-form label-width="100px">
        <el-form-item label="来源条目" required>
          <el-select v-model="starterForm.recordId" filterable placeholder="选择图谱条目" style="width: 100%">
            <el-option
              v-for="record in recordState.records"
              :key="record.id"
              :label="`${record.code} · ${record.tempName || '未命名条目'}（采集 ${record.collectDate}）`"
              :value="record.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="管号" required>
          <el-input v-model="starterForm.tubeNo" placeholder="纸面试管编号，如 BHS-2026-001-P0" />
        </el-form-item>
        <el-form-item label="培养基" required>
          <el-select v-model="starterForm.medium" filterable allow-create default-first-option placeholder="选择或输入培养基" style="width: 100%">
            <el-option v-for="medium in mediumOptions" :key="medium" :label="medium" :value="medium" />
          </el-select>
        </el-form-item>
        <el-form-item label="分离日期" required>
          <el-date-picker v-model="starterForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          <p v-if="starterRecord" class="form-hint">不得早于采集日期 {{ starterRecord.collectDate }}</p>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="starterForm.note" type="textarea" :rows="2" placeholder="如 孢子印组织分离，萌发良好" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="starterVisible = false">取消</el-button>
        <el-button type="primary" @click="submitStarter">保存起始管</el-button>
      </template>
    </el-dialog>

    <!-- 转接 -->
    <el-dialog v-model="transferVisible" title="转接培养管" width="560px">
      <el-alert v-if="transferParent" type="info" :closable="false" class="transfer-alert">
        <template #title>
          母管 <b class="mono">{{ transferParent.tubeNo }}</b>（P{{ transferParent.generation }}）→
          新管代次自动记为 P{{ transferParent.generation + 1 }}
        </template>
      </el-alert>
      <el-form label-width="100px">
        <el-form-item label="新管号" required>
          <el-input v-model="transferForm.tubeNo" placeholder="新纸面试管编号" />
        </el-form-item>
        <el-form-item label="培养基" required>
          <el-select v-model="transferForm.medium" filterable allow-create default-first-option placeholder="选择或输入培养基" style="width: 100%">
            <el-option v-for="medium in mediumOptions" :key="medium" :label="medium" :value="medium" />
          </el-select>
        </el-form-item>
        <el-form-item label="转接日期" required>
          <el-date-picker v-model="transferForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          <p v-if="transferParent" class="form-hint">不得早于母管日期 {{ transferParent.date }}</p>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="transferForm.note" type="textarea" :rows="2" placeholder="如 菌丝洁白，长势良好" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTransfer">确认转接</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.table-card {
  border-radius: 12px;
}
.form-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8a5a1f;
}
.transfer-alert {
  margin-bottom: 14px;
}
.rec-link {
  color: var(--gb-accent);
  text-decoration: none;
}
.rec-link:hover {
  text-decoration: underline;
}
.lineage-box {
  padding: 10px 18px 12px;
  background: #faf7f1;
}
.lineage-chain {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.lineage-root {
  margin-left: 6px;
  font-size: 11px;
  color: #8a5a1f;
}
.lineage-arrow {
  color: #a08b74;
}
.lineage-meta {
  margin: 8px 0 0;
  font-size: 12px;
  color: #4b5b50;
}
.lineage-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6f7d72;
}
</style>
