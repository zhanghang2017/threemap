<script setup>
import ThreeMap from "./components/ThreeMap/index.vue";
</script>

<template>
  <div class="app-container">
    <ThreeMap />
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0a0e27;
}

.app-container {
  width: 100%;
  height: 100%;
}
</style>
