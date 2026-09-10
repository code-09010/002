const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `请求失败（${res.status}）`)
  }
  return res.json()
}

function query(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null)
  return entries.length ? '?' + new URLSearchParams(entries) : ''
}

export const api = {
  fields: () => request('/fields'),
  fieldDetail: (id) => request(`/fields/${id}`),
  crops: () => request('/crops'),
  records: (params) => request('/records' + query(params)),
  createRecord: (data) => request('/records', { method: 'POST', body: JSON.stringify(data) }),
  plan: (year) => request('/rotation/plan' + (year ? `?year=${year}` : '')),
}
