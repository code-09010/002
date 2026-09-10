<template>
  <div>
    <header class="topbar">
      <div class="brand">🌾 农田茬口轮作管理</div>
      <nav>
        <router-link to="/fields" :class="{ active: $route.path === '/fields' }">地块管理</router-link>
        <router-link to="/entry" :class="{ active: $route.path === '/entry' }">农事录入</router-link>
        <router-link to="/plan" :class="{ active: $route.path === '/plan' }">茬口安排</router-link>
      </nav>
    </header>
    <router-view />
  </div>
</template>
