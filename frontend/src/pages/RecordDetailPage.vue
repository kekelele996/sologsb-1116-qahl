<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { CollectPoint, CultureTube, SporeColor, SporePrint } from '@/types'
import { SPORE_COLORS } from '@/types'
import GeoPointForm from '@/components/common/GeoPointForm.vue'
import GillAttachmentTag from '@/components/common/GillAttachmentTag.vue'
import SporePrintSwatch from '@/components/common/SporePrintSwatch.vue'
import TraitsSummary from '@/components/common/TraitsSummary.vue'
import InitialTubeDialog from '@/components/strain/InitialTubeDialog.vue'
import TransferDialog from '@/components/strain/TransferDialog.vue'
import LineageDialog from '@/components/strain/LineageDialog.vue'
import { useStore } from '@/hooks/usePersistentStore'
import { useTubeActions } from '@/hooks/useTubeActions'
import { recordStore } from '@/stores/recordStore'
import { sporeStore } from '@/stores/sporeStore'
import { pointStore } from '@/stores/pointStore'
import { identifyStore } from '@/stores/identifyStore'
import { strainStore } from '@/stores/strainStore'
import { sporeColorHex } from '@/utils/spore'
import { strainStats, tubeStatusType } from '@/utils/strain'
import { uid } from '@/utils/id'

const route = useRoute()
const router = useRouter()
const recordState = useStore(recordStore)
const sporeState = useStore(sporeStore)
const pointState = useStore(pointStore)
const identifyState = useStore(identifyStore)
const strainState = useStore(strainStore)

const record = computed(() => recordState.records.find((item) => item.id === route.params.id) ?? null)
const spore = computed(() => sporeState.spores.find((item) => item.recordId === record.value?.id) ?? null)
const logs = computed(() => identifyState.logs.filter((item) => item.recordId === record.value?.id))
/** 当前条目名下全部菌管与保藏统计（当前管数 / 在存数 / 最高代次） */
const recordTubes = computed(() => strainState.tubes.filter((item) => item.recordId === record.value?.id))
const tubeStats = computed(() =>
  record.value ? strainStats(strainState.tubes, record.value.id) : { total: 0, active: 0, maxGeneration: 0 }
)

const initialVisible = ref(false)
const { transferVisible, transferParent, lineageVisible, lineageTube, openTransfer, openLineage, markStatus } =
  useTubeActions()

function parentNo(parentId: string | null): string {
  if (!parentId) return '—'
  return strainState.tubes.find((item) => item.id === parentId)?.tubeNo ?? '（母管已删）'
}
/** 当前条目所属采集点名称（在脚本内取，避免模板内箭头函数丢失空值收窄） */
const recordPointName = computed(() => {
  const current = record.value
  if (!current) return '未关联'
  return pointState.points.find((item) => item.id === current.pointId)?.name ?? '未关联'
})

const sporeForm = reactive({
  id: '',
  color: '白色' as SporeColor,
  shape: '',
  hours: 12,
  observeDate: new Date().toISOString().slice(0, 10),
  moisture: ''
})

const pointDraft = reactive<CollectPoint>({
  id: '',
  name: '',
  longitude: 0,
  latitude: 0,
  altitude: 0,
  vegetation: '针阔混交林',
  substrate: '落叶层',
  companionTrees: '',
  collectDate: '',
  collector: ''
})

watch(
  () => [record.value?.id, spore.value?.id, pointState.points.length] as const,
  () => {
    if (!record.value) return
    const current = spore.value
    if (current) {
      sporeForm.id = current.id
      sporeForm.color = current.color
      sporeForm.shape = current.shape
      sporeForm.hours = current.hours
      sporeForm.observeDate = current.observeDate
      sporeForm.moisture = current.moisture
    }
    const point = pointState.points.find((item) => item.id === record.value?.pointId)
    if (point) Object.assign(pointDraft, point)
  },
  { immediate: true }
)

async function saveSpore(): Promise<void> {
  if (!record.value) return
  const row: SporePrint = {
    id: sporeForm.id || uid('spo'),
    recordId: record.value.id,
    color: sporeForm.color,
    shape: sporeForm.shape.trim(),
    hours: Number(sporeForm.hours) || 0,
    observeDate: sporeForm.observeDate,
    moisture: sporeForm.moisture.trim()
  }
  await sporeStore.getState().save(row)
  sporeForm.id = row.id
  ElMessage.success(`孢子印观察已记录：${row.color}`)
}

async function savePoint(): Promise<void> {
  if (!pointDraft.name.trim()) {
    ElMessage.warning('采集点名称不能为空')
    return
  }
  await pointStore.getState().save({ ...pointDraft })
  ElMessage.success('采集点信息已更新')
}

async function removeSpore(): Promise<void> {
  if (!sporeForm.id) return
  await sporeStore.getState().remove(sporeForm.id)
  sporeForm.id = ''
  ElMessage.success('孢子印记录已删除')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div v-if="record">
        <h2 class="page-title">{{ record.tempName || '未命名条目' }}</h2>
        <p class="page-sub">
          <span class="mono">{{ record.code }}</span> · 采集点
          {{ recordPointName }} · 采集日期
          {{ record.collectDate }} · 采集人 {{ record.collector || '—' }}
        </p>
      </div>
      <div v-else>
        <h2 class="page-title">条目详情</h2>
        <p class="page-sub">未找到该条目，可能已被删除。</p>
      </div>
      <div class="head-actions">
        <el-button @click="router.push('/atlas')">返回图谱</el-button>
        <el-button v-if="record" @click="router.push('/identify')">去鉴定</el-button>
      </div>
    </div>

    <template v-if="record">
      <el-card shadow="never" class="block">
        <template #header>
          <div class="block-head">
            <span>形态描述</span>
            <GillAttachmentTag :attachment="record.attachment" with-hint />
          </div>
        </template>
        <TraitsSummary :record="record" :spore="spore" :default-open="['cap', 'flesh', 'gill', 'stipe', 'eco']" />
        <p v-if="record.note" class="note">现场备注：{{ record.note }}</p>
      </el-card>

      <el-card shadow="never" class="block">
        <template #header>
          <div class="block-head">
            <span>孢子印观察</span>
            <SporePrintSwatch :color="spore?.color ?? null" size="large" :caption="spore ? `获取 ${spore.hours} h` : '尚未记录'" />
          </div>
        </template>
        <div class="spore-body">
          <div class="spore-current" :style="{ background: spore ? sporeColorHex(spore.color) : '#f2f4f6' }">
            <div v-if="spore" class="spore-info">
              <p class="spore-color">{{ spore.color }}</p>
              <p class="spore-meta">印形：{{ spore.shape || '—' }}</p>
              <p class="spore-meta">时长：{{ spore.hours }} 小时 · 观察日期 {{ spore.observeDate }}</p>
              <p class="spore-meta">样本干湿度：{{ spore.moisture || '—' }}</p>
            </div>
            <p v-else class="spore-empty">该条目尚未登记孢子印观察</p>
          </div>
          <el-form label-width="92px" class="spore-form">
            <el-form-item label="印色">
              <el-select v-model="sporeForm.color" style="width: 100%">
                <el-option v-for="color in SPORE_COLORS" :key="color" :label="color" :value="color" />
              </el-select>
            </el-form-item>
            <el-form-item label="印形">
              <el-input v-model="sporeForm.shape" placeholder="如 圆形印痕，边缘略散" />
            </el-form-item>
            <el-form-item label="时长(h)">
              <el-input-number v-model="sporeForm.hours" :min="0" :step="1" :controls="false" style="width: 100%" />
            </el-form-item>
            <el-form-item label="观察日期">
              <el-date-picker v-model="sporeForm.observeDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="干湿度">
              <el-input v-model="sporeForm.moisture" type="textarea" :rows="2" placeholder="如 子实体偏干，印痕较薄" />
            </el-form-item>
            <div class="form-actions">
              <el-button type="primary" @click="saveSpore">{{ sporeForm.id ? '更新孢子印' : '登记孢子印' }}</el-button>
              <el-button v-if="sporeForm.id" type="danger" plain @click="removeSpore">删除记录</el-button>
            </div>
          </el-form>
        </div>
      </el-card>

      <el-card shadow="never" class="block">
        <template #header>
          <div class="block-head">
            <span>菌种保藏</span>
            <div class="strain-head">
              <el-tag effect="plain">当前管数 {{ tubeStats.total }}（在存 {{ tubeStats.active }}）</el-tag>
              <el-tag type="warning" effect="plain">
                最高代次 {{ tubeStats.maxGeneration > 0 ? `G${tubeStats.maxGeneration}` : '—' }}
              </el-tag>
              <el-button size="small" type="primary" @click="initialVisible = true">建立起始管</el-button>
            </div>
          </div>
        </template>
        <el-table v-if="recordTubes.length > 0" :data="recordTubes" border stripe>
          <el-table-column label="管号" min-width="170">
            <template #default="{ row }: { row: CultureTube }">
              <span class="mono tube-no">{{ row.tubeNo }}</span>
              <el-tag v-if="row.parentId === null" size="small" effect="plain">起始管</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="代次" width="70" align="center">
            <template #default="{ row }: { row: CultureTube }">G{{ row.generation }}</template>
          </el-table-column>
          <el-table-column prop="medium" label="培养基" width="100" />
          <el-table-column prop="isolateDate" label="分离/转接日期" width="120" />
          <el-table-column label="母管" min-width="140">
            <template #default="{ row }: { row: CultureTube }">
              <span class="mono">{{ parentNo(row.parentId) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }: { row: CultureTube }">
              <el-tag :type="tubeStatusType(row.status)" size="small" effect="dark">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="270">
            <template #default="{ row }: { row: CultureTube }">
              <el-button v-if="row.status === '在存'" size="small" type="primary" plain @click="openTransfer(row)">
                转接
              </el-button>
              <el-button size="small" @click="openLineage(row)">历代</el-button>
              <template v-if="row.status === '在存'">
                <el-button size="small" type="warning" plain @click="markStatus(row, '污染')">标污染</el-button>
                <el-button size="small" type="danger" plain @click="markStatus(row, '废弃')">标废弃</el-button>
              </template>
              <el-button v-else size="small" type="success" plain @click="markStatus(row, '在存')">恢复在存</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="尚未保藏菌种：孢子印或组织分离后，点击「建立起始管」登记 G1" />
      </el-card>

      <el-card shadow="never" class="block">
        <template #header>采集点信息（含经纬度校验）</template>
        <GeoPointForm v-model="pointDraft" with-meta />
        <div class="form-actions">
          <el-button type="primary" @click="savePoint">保存采集点</el-button>
        </div>
      </el-card>

      <el-card shadow="never" class="block">
        <template #header>鉴定留痕（{{ logs.length }} 条）</template>
        <el-table :data="logs" border stripe>
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="conclusion" label="结论学名" min-width="160" />
          <el-table-column prop="basis" label="依据" width="110" />
          <el-table-column label="参考图鉴" min-width="180">
            <template #default="{ row }: { row: { referenceBook: string; referencePage: string } }">
              {{ row.referenceBook || '—' }} {{ row.referencePage }}
            </template>
          </el-table-column>
          <el-table-column prop="confidence" label="置信度" width="90" />
          <el-table-column label="复核" width="110">
            <template #default="{ row }: { row: { needReview: boolean; reviewer: string } }">
              <el-tag v-if="row.needReview" type="warning" size="small" effect="dark">待复核</el-tag>
              <span v-else class="muted">{{ row.reviewer || '已复核' }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="logs.length === 0" description="尚无鉴定结论，去「鉴定工作页」生成" />
      </el-card>
    </template>

    <InitialTubeDialog v-model="initialVisible" :record-id="record?.id" />
    <TransferDialog v-model="transferVisible" :parent="transferParent" />
    <LineageDialog v-model="lineageVisible" :tube="lineageTube" />
  </div>
</template>

<style scoped>
.head-actions {
  display: flex;
  gap: 8px;
}
.block {
  border-radius: 12px;
  margin-bottom: 16px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.strain-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tube-no {
  font-weight: 600;
  margin-right: 6px;
}
.note {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f7f5f0;
  font-size: 12px;
  color: #6f7d72;
}
.spore-body {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.spore-current {
  flex: 1 1 260px;
  min-height: 180px;
  border-radius: 12px;
  border: 1px solid #e8e2d6;
  padding: 16px;
  display: flex;
  align-items: center;
}
.spore-info p {
  margin: 2px 0;
}
.spore-color {
  font-size: 20px;
  font-weight: 700;
}
.spore-meta {
  font-size: 12px;
  color: #4b5b50;
}
.spore-empty {
  font-size: 13px;
  color: #7f8d82;
}
.spore-form {
  flex: 1 1 320px;
}
.form-actions {
  display: flex;
  gap: 8px;
  padding-left: 92px;
}
</style>
