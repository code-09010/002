<template>
  <div class="page">
    <h2>地块管理</h2>
    <p class="desc">点击地块卡片查看历史种植记录和下茬推荐</p>

    <div class="stats" v-if="fields.length">
      <div class="stat"><b>{{ fields.length }}</b>块地</div>
      <div class="stat"><b>{{ growingCount }}</b>块在田</div>
      <div class="stat"><b>{{ idleCount }}</b>块待播</div>
      <div class="stat warn" v-if="riskCount"><b>{{ riskCount }}</b>块重茬风险</div>
    </div>

    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="error" class="notice error">{{ error }}</div>

    <div v-else class="field-grid">
      <div
        v-for="f in fields"
        :key="f.id"
        class="field-card"
        @click="openDetail(f)"
      >
        <div class="head">
          <div>
            <span class="code">{{ f.code }}</span>
            <span class="name">{{ f.name }}</span>
          </div>
          <div>
            <span class="badge" :class="statusClass(f.status)">{{ f.status }}</span>
            <span v-if="f.continuous_crop" class="badge danger">重茬</span>
          </div>
        </div>
        <div class="meta">{{ f.area_mu }} 亩 · {{ f.soil_type }}</div>
        <div class="current">
          <template v-if="f.current">
            当前：{{ f.current.crop_name }}<template v-if="f.current.variety">（{{ f.current.variety }}）</template>
            · {{ f.current.sow_date }} 播
          </template>
          <template v-else>暂无种植记录</template>
        </div>
        <div v-if="f.next_recommendation" class="next">
          建议下茬：{{ f.next_recommendation.crop }}（{{ f.next_recommendation.sow_window }}播）
        </div>
      </div>
    </div>

    <!-- 地块详情弹窗 -->
    <div v-if="detail" class="modal-mask" @click.self="detail = null">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ detail.field.code }} · {{ detail.field.name }}</h3>
          <button class="close" @click="detail = null">×</button>
        </div>
        <p class="desc" style="margin-bottom:14px">
          {{ detail.field.area_mu }} 亩 · {{ detail.field.soil_type }} · 下茬可播起始 {{ detail.earliest_date }}
        </p>

        <h4 class="section-title" style="margin-top:0">下茬推荐</h4>
        <div class="rec-list">
          <div v-for="r in detail.recommendations" :key="r.crop" class="rec-card">
            <div class="crop">{{ r.crop }} <span class="badge growing">{{ r.family }}</span></div>
            <div class="when">{{ r.sow_window }}播种（{{ r.sow_date }}）</div>
            <div class="why">{{ r.reason }}</div>
          </div>
        </div>

        <h4 class="section-title">历史种植记录（{{ detail.records.length }} 茬）</h4>
        <table class="sheet" v-if="detail.records.length">
          <thead>
            <tr>
              <th>作物</th><th>品种</th><th>播种日期</th>
              <th>施肥</th><th>灌溉</th><th>产量(公斤/亩)</th><th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in detail.records" :key="r.id">
              <td>{{ r.crop_name }}</td>
              <td>{{ r.variety || '—' }}</td>
              <td>{{ r.sow_date }}</td>
              <td>{{ r.fertilizer_type ? `${r.fertilizer_type}${r.fertilizer_amount != null ? ' ' + r.fertilizer_amount + '公斤' : ''}` : '—' }}</td>
              <td>{{ r.irrigate_date || '—' }}</td>
              <td>{{ r.harvest_yield ?? '—' }}</td>
              <td>
                <span class="badge" :class="r.harvest_yield == null ? 'growing' : 'idle'">
                  {{ r.harvest_yield == null ? '在田' : '已收' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-tip">暂无记录，可在「农事录入」中登记</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'

const fields = ref([])
const loading = ref(true)
const error = ref('')
const detail = ref(null)

const growingCount = computed(() => fields.value.filter(f => f.status === '在田').length)
const idleCount = computed(() => fields.value.filter(f => f.status === '待播').length)
const riskCount = computed(() => fields.value.filter(f => f.continuous_crop).length)

function statusClass(status) {
  return { 在田: 'growing', 待播: 'idle', 空闲: 'empty' }[status] || 'idle'
}

async function openDetail(field) {
  try {
    detail.value = await api.fieldDetail(field.id)
  } catch (e) {
    error.value = e.message
  }
}

onMounted(async () => {
  try {
    fields.value = await api.fields()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>
