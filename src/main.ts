import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import FileSelector from './components/FileSelector.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Register FileSelector globally so it can be used as <FileSelector /> in templates
app.component('FileSelector', FileSelector)

app.mount('#app')
