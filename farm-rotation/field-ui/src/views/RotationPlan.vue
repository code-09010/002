<template>
  <div class="page">
    <h2>茬口安排</h2>
    <p class="desc">按季度生成轮作计划；也可按品种名称查找种植地块、按播种日期排序</p>

    <!-- 轮作计划 -->
    <div class="toolbar">
      <div class="form-item">
        <label>计划年份</label>
        <select v-model="year">
          <option value="">全部</option>
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
        </select>
      </div>
      <button class="primary" @click="loadPlan">生成轮作计划</button>
      <span v-if="generatedAt" class="desc" style="margin:0">生成日期：{{ generatedAt }}</span>
    </div>

    <div v-if="planLoading" class="loading">计算中…</div>
    <div v-else-if="planError" class="notice error">{{ planError }}</div>
    <template v-else-if="quarters.length">
      <div v-for="q in quarters" :key="q.quarter" class="quarter-block">
        <h3>{{ q.quarter.replace('-', ' 年 ') }} 季度<span class="count">{{ q.items.length }} 块地待安排</span></h3>
        <table class="sheet">
          <thead>
            <tr>
              <th>地块</th><th>面积</th><th>上茬作物</th>
              <th>计划种植</th><th>计划播种</th><th>推荐理由</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in q.items" :key="item.field_code">
              <td>{{ item.field_code }} · {{ item.field_name }}</td>
              <td>{{ item.area_mu }} 亩</td>
              <td>
                <template v-if="item.last_crop">
                  {{ item.last_crop }}<template v-if="item.last_variety">（{{ item.last_variety }}）</template>
                </template>
                <template v-else>—</template>
              </td>
              <td><b>{{ item.planned_crop }}</b> <span class="badge growing">{{ item.planned_family }}</span></td>
              <td>{{ item.planned_sow_date }}</td>
              <td style="color:var(--gray-600); font-size:13px">{{ item.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <div v-else class="empty-tip">点击「生成轮作计划」查看各季度的种植安排</div>

    <!-- 品种查找 -->
    <h3 class="section-title">按品种查找种植地块</h3>
    <div class="toolbar">
      <div class="form-item">
        <label>品种名称</label>
        <input v-model.trim="varietyQuery" list="variety-list" placeholder="如 济麦22" @keyup.enter="searchVariety" />
        <datalist id="variety-list">
          <option v-for="v in knownVarieties" :key="v" :value="v" />
        </datalist>
      </div>
      <button class="primary" @click="searchVariety">查找</button>
    </div>

    <div v-if="searchError" class="notice error">{{ searchError }}</div>
    <table v-else-if="searchResults.length" class="sheet">
      <thead>
        <tr>
          <th>地块编号</th><th>作物</th><th>品种</th>
          <th class="sortable" @click="toggleSort">
            播种日期 {{ sortOrder === 'asc' ? '↑' : '↓' }}
          </th>
          <th>产量(公斤/亩)</th><th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in searchResults" :key="r.id">
          <td>{{ r.field_code }} · {{ r.field_name }}</td>
          <td>{{ r.crop_name }}</td>
          <td>{{ r.variety || '—' }}</td>
          <td>{{ r.sow_date }}</td>
          <td>{{ r.harvest_yield ?? '—' }}</td>
          <td>
            <span class="badge" :class="r.harvest_yield == null ? 'growing' : 'idle'">
              {{ r.harvest_yield == null ? '在田' : '已收' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="searched" class="empty-tip">没有查到该品种的种植记录</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../api'

// 轮作计划
const year = ref('')
const yearOptions = [2026, 2027, 2028]
const quarters = ref([])
const generatedAt = ref('')
const planLoading = ref(false)
const planError = ref('')

async function loadPlan() {
  planLoading.value = true
  planError.value = ''
  try {
    const data = await api.plan(year.value)
    quarters.value = data.quarters
    generatedAt.value = data.generated_at
  } catch (e) {
    planError.value = e.message
  } finally {
    planLoading.value = false
  }
}

// 品种查找
const varietyQuery = ref('')
const sortOrder = ref('desc')
const searchResults = ref([])
const searched = ref(false)
const searchError = ref('')
const knownVarieties = ref([])

async function searchVariety() {
  searchError.value = ''
  searched.value = true
  try {
    searchResults.value = await api.records({
      variety: varietyQuery.value,
      sort: 'sow_date',
      order: sortOrder.value,
    })
  } catch (e) {
    searchError.value = e.message
  }
}

function toggleSort() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  searchVariety()
}

onMounted(async () => {
  loadPlan()
  try {
    const all = await api.records({})
    knownVarieties.value = [...new Set(all.map(r => r.variety).filter(Boolean))].sort()
  } catch { /* 品种提示加载失败不影响主功能 */ }
})
</script>
