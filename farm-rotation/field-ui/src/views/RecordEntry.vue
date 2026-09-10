<template>
  <div class="page">
    <h2>农事录入</h2>
    <p class="desc">按地块编号登记播种、施肥、灌溉和收获情况，提交后系统自动推算下茬推荐作物</p>

    <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap">
      <!-- 录入表单 -->
      <form class="form-panel" style="flex:1.4; min-width:340px" @submit.prevent="submit">
        <div class="form-grid">
          <div class="form-item">
            <label>地块编号 <span class="req">*</span></label>
            <select v-model="form.field_code" required>
              <option value="" disabled>请选择地块</option>
              <option v-for="f in fields" :key="f.id" :value="f.code">
                {{ f.code }} · {{ f.name }}（{{ f.area_mu }}亩）
              </option>
            </select>
          </div>
          <div class="form-item">
            <label>作物 <span class="req">*</span></label>
            <select v-model="form.crop_name" required>
              <option value="" disabled>请选择作物</option>
              <option v-for="c in crops" :key="c.id" :value="c.name">
                {{ c.name }}（{{ c.family }}）
              </option>
            </select>
          </div>
          <div class="form-item">
            <label>品种</label>
            <input v-model.trim="form.variety" list="variety-list" placeholder="如 济麦22" />
            <datalist id="variety-list">
              <option v-for="v in knownVarieties" :key="v" :value="v" />
            </datalist>
          </div>
          <div class="form-item">
            <label>播种日期 <span class="req">*</span></label>
            <input v-model="form.sow_date" type="date" required />
          </div>
          <div class="form-item">
            <label>施肥种类</label>
            <input v-model.trim="form.fertilizer_type" list="fert-list" placeholder="如 复合肥(15-15-15)" />
            <datalist id="fert-list">
              <option v-for="t in fertilizerTypes" :key="t" :value="t" />
            </datalist>
          </div>
          <div class="form-item">
            <label>施肥用量（公斤/亩）</label>
            <input v-model.number="form.fertilizer_amount" type="number" min="0" step="0.1" placeholder="如 40" />
          </div>
          <div class="form-item">
            <label>灌溉时间</label>
            <input v-model="form.irrigate_date" type="date" />
          </div>
          <div class="form-item">
            <label>收获产量（公斤/亩）</label>
            <input v-model.number="form.harvest_yield" type="number" min="0" step="0.1" placeholder="留空表示在田未收" />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="primary" :disabled="submitting">
            {{ submitting ? '提交中…' : '登记' }}
          </button>
          <button type="button" class="ghost" @click="reset">清空</button>
        </div>

        <div v-if="result" class="notice success">
          已登记：{{ result.record.field_code || form.field_code }} {{ result.record.crop_name }}（{{ result.record.sow_date }} 播种）
        </div>
        <div v-if="warnings.length" class="notice warn">
          <b>⚠ 茬口预警</b>
          <ul><li v-for="(w, i) in warnings" :key="i">{{ w }}</li></ul>
        </div>
        <div v-if="error" class="notice error">{{ error }}</div>
      </form>

      <!-- 下茬推荐侧栏 -->
      <div class="form-panel" style="flex:1; min-width:300px">
        <h4 style="margin:0 0 10px; color:var(--green-900)">下茬推荐</h4>
        <template v-if="sideRecs.length">
          <p class="desc" style="margin-bottom:10px">
            {{ sideFieldLabel }} · 下茬可播起始 {{ sideEarliest }}
          </p>
          <div class="rec-list" style="flex-direction:column">
            <div v-for="r in sideRecs" :key="r.crop" class="rec-card">
              <div class="crop">{{ r.crop }} <span class="badge growing">{{ r.family }}</span></div>
              <div class="when">{{ r.sow_window }}播种（{{ r.sow_date }}）</div>
              <div class="why">{{ r.reason }}</div>
            </div>
          </div>
        </template>
        <p v-else class="desc">选择地块后，这里会显示系统推算的下茬推荐作物</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../api'

const fields = ref([])
const crops = ref([])
const records = ref([])
const error = ref('')
const submitting = ref(false)
const result = ref(null)
const warnings = ref([])

const sideRecs = ref([])
const sideEarliest = ref('')

const blank = {
  field_code: '', crop_name: '', variety: '', sow_date: '',
  fertilizer_type: '', fertilizer_amount: null, irrigate_date: '', harvest_yield: null,
}
const form = ref({ ...blank })

const fertilizerTypes = ['复合肥(15-15-15)', '尿素', '磷酸二铵', '过磷酸钙', '硫酸钾', '农家肥', '有机肥+复合肥']

// 已有品种做输入提示
const knownVarieties = computed(() =>
  [...new Set(records.value.map(r => r.variety).filter(Boolean))].sort()
)

const sideFieldLabel = computed(() => {
  const f = fields.value.find(x => x.code === form.value.field_code)
  return f ? `${f.code} · ${f.name}` : ''
})

// 选中地块后实时刷新下茬推荐
watch(() => form.value.field_code, async code => {
  result.value = null
  warnings.value = []
  sideRecs.value = []
  if (!code) return
  const f = fields.value.find(x => x.code === code)
  if (!f) return
  try {
    const d = await api.fieldDetail(f.id)
    sideRecs.value = d.recommendations
    sideEarliest.value = d.earliest_date
  } catch (e) {
    error.value = e.message
  }
})

async function submit() {
  submitting.value = true
  error.value = ''
  result.value = null
  warnings.value = []
  try {
    const payload = { ...form.value }
    if (payload.fertilizer_amount === null || payload.fertilizer_amount === '') delete payload.fertilizer_amount
    if (payload.harvest_yield === null || payload.harvest_yield === '') delete payload.harvest_yield
    const res = await api.createRecord(payload)
    result.value = res
    warnings.value = res.warnings
    sideRecs.value = res.recommendations
    // 刷新品种提示和地块状态
    records.value = await api.records({})
    fields.value = await api.fields()
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

function reset() {
  form.value = { ...blank }
  result.value = null
  warnings.value = []
  error.value = ''
}

onMounted(async () => {
  try {
    ;[fields.value, crops.value, records.value] = await Promise.all([
      api.fields(), api.crops(), api.records({}),
    ])
  } catch (e) {
    error.value = e.message
  }
})
</script>
