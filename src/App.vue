<template>
  <div id="container">

    <input class="search" type="text" v-model="search" placeholder="Search by name or issuer">

    <div
      v-for="code in qrCodesFiltered"
      :key="code.id"
      class="mfa-code"
      @click="copyToken(code)"
    >
      <div class="info">
        <div class="info-name info-item">{{ code.name }}</div>
        <div class="info-item info-issuer">{{ code.issuer }}</div>
      </div>

      <div class="code">
        <span>
          {{ code.mfa }}
        </span>


          <div class="pie" :style='{
              width: "1.5rem",
              height: "1.5rem",
              background: `conic-gradient(var(--color-primary-accent) ${Math.ceil(progress)}deg, transparent ${Math.ceil(progress)}deg)`,
              borderRadius: "50%",
              marginLeft: "1rem",
          }'

          ></div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, toRaw, onUnmounted, computed } from 'vue'

const qrCodes = ref([])
const progress = ref(0)
const timer = ref(null)
const search = ref("")


const qrCodesFiltered = computed(() => {
  if(search.value.length === 0){
    return qrCodes.value
  }

  return qrCodes.value.filter(code => {
    if(code.issuer.toLowerCase().includes(search.value.toLowerCase())) return true
    if(code.name.toLowerCase().includes(search.value.toLowerCase())) return true
    return false
  })
})

function updateProgress() {
  const now = Date.now()
  const elapsed = now % 30000
  const remaining = 30000 - elapsed
  progress.value = (remaining / 30000) * 360
}

async function getCodes() {
  const response = await window.qrCodes.getCodes()
  return response
}

async function getMfa(codeObject) {
  const raw = toRaw(codeObject);
  const response = await window.qrCodes.getMfa(raw)
  return response
}

function scheduleNext() {

  const now = Date.now()
  const delay = 30000 - (now % 30000)

  setTimeout(async () => {

    qrCodes.value.map(async code => {
      code.mfa = await getMfa(code)
    })

    scheduleNext()
  }, delay)
}

async function getAllMfa(codes){
  const res = await Promise.all(
    codes.map(async (code) => {
      const mfa = await getMfa(code)
      return { ...code, mfa }
    })
  )

  return res;
}

async function main() {
  const codes = await getCodes()
  qrCodes.value = await getAllMfa(codes);
}

function copyToken(code){

  const temp = code.issuer;
  code.issuer = "Copied to clipboard"
  window.navigator.clipboard.writeText(code.mfa)

  setTimeout(() => code.issuer = temp, 3000)
}

onMounted( async () => {
  await main()
  scheduleNext()

  updateProgress()
  timer.value = setInterval(updateProgress, 100)
})


onUnmounted(() => clearInterval(timer.value))

</script>

<style>
*, *::before, *::after{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root{
    --color-white: #F9F7F7;
    --color-primary-background: #DBE2EF;
    --color-primary-text: #112D4E;
    --color-primary-accent: #3F72AF;
}

body{
    background-color: var(--color-white);
    color: var(--color-primary-text);
    font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
}

#container{
    display: flex;
    flex-direction: column;
    gap: .5rem;

    padding: 1rem;
}

#container .mfa-code {
    display: flex;
    width: 100%;
    background-color: hue(0, 0, 50%);
    border-radius: .25rem;
    padding-block: .5rem;
    background-color: var(--color-primary-background);
    padding-inline: 1rem;
    cursor: pointer;
}


#container .mfa-code > div {
    display: flex;
}

#container .mfa-code > div:nth-child(1) {
    flex: 0 0 70%;
    display: flex;
    flex-direction: column;
}

#container .mfa-code > div:nth-child(2) {
    flex: 0 0 30%;

    display: flex;

    align-items: center;
}

.code {
  padding-left: 1rem;
  font-weight: 600;
}

.info-issuer{
    opacity: .9;
    font-size: .75rem;
}

.search, .search:focus{
  height: 2rem;
  border-radius: .5rem;
  padding-inline: 20px;
  border: 1px solid var(--color-primary-accent);
  outline: 0;
}



</style>
