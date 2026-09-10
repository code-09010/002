import { createRouter, createWebHistory } from 'vue-router'
import FieldGrid from './views/FieldGrid.vue'
import RecordEntry from './views/RecordEntry.vue'
import RotationPlan from './views/RotationPlan.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/fields' },
    { path: '/fields', name: 'fields', component: FieldGrid, meta: { title: '地块管理' } },
    { path: '/entry', name: 'entry', component: RecordEntry, meta: { title: '农事录入' } },
    { path: '/plan', name: 'plan', component: RotationPlan, meta: { title: '茬口安排' } },
  ],
})
