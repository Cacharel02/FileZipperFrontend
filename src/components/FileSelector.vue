<script setup lang="ts">
import { ref } from 'vue'

const files = ref<File[]>([])

// Success state after zip operation
const isSuccess = ref(false)
const resultUrl = ref<string | null>(null)
const resultFilename = ref('')

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    const newFiles = Array.from(target.files)
    const existingKeys = new Set(files.value.map(f => `${f.name}|${f.size}|${f.lastModified}`))
    for (const f of newFiles) {
      const key = `${f.name}|${f.size}|${f.lastModified}`
      if (!existingKeys.has(key)) {
        files.value.push(f)
        existingKeys.add(key)
      }
    }
    target.value = ''
  }
}

const removeFile = (index: number) => {
  files.value.splice(index, 1)
}

const clearAll = () => {
  files.value = []
}


const zipEndpoint = 'http://localhost:8080/filezippertool/zip'

const isLoading = ref(false)

const downloadResult = () => {
  if (!resultUrl.value) return
  const a = document.createElement('a')
  a.href = resultUrl.value
  a.download = resultFilename.value || 'archive.zip'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke after a short delay to ensure download starts
  setTimeout(() => {
    if (resultUrl.value) {
      URL.revokeObjectURL(resultUrl.value)
      resultUrl.value = null
    }
  }, 1000)
}

const returnToFiles = () => {
  if (resultUrl.value) {
    URL.revokeObjectURL(resultUrl.value)
    resultUrl.value = null
  }
  resultFilename.value = ''
  isSuccess.value = false
  // keep `files` selection as requested
}

const zipFiles = async () => {
  if (!zipEndpoint) {
    console.warn('No zipEndpoint configured for FileSelector.')
    return
  }

  if (files.value.length === 0) return

  const form = new FormData()
  files.value.forEach((f) => form.append('files', f))

  isLoading.value = true
  try {
    const res = await fetch(zipEndpoint, {
      method: 'POST',
      body: form,
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Zip upload failed:', res.status, text)
      alert('L\'envoi a échoué : ' + res.status)
    } else {
      // Response is expected to be a binary file (bytes) — prepare it for user download
      try {
        const disposition = (res.headers.get('content-disposition') || '')
        const blob = await res.blob()

        // Try to extract filename according to RFC5987 (filename*=UTF-8''...) first,
        // then fallback to filename="..." or filename=...
        let filename = ''

        const rfc5987 = /filename\*=(?:UTF-8'')?([^;\n\r]+)/i.exec(disposition)
        const fallback = /filename=(?:"?)([^";]+)(?:"?)/i.exec(disposition)

        const match = rfc5987 || fallback
        if (match && match[1]) {
          let raw = match[1].trim()
          // strip surrounding quotes if any
          raw = raw.replace(/^"|"$/g, '')
          try {
            // decodeURIComponent for percent-encoded UTF-8 (RFC5987)
            filename = decodeURIComponent(raw)
          } catch (e) {
            // if decode fails, use raw value
            filename = raw
          }
        }

        // Fallback filename if header absent or parsing failed
        if (!filename) {
          if (blob.type === 'application/zip') filename = 'archive.zip'
          else if (blob.type) filename = `files.${blob.type.split('/')[1] || 'bin'}`
          else filename = 'archive.bin'
        }

        // Instead of forcing immediate download, expose an object URL and show success UI
        const url = URL.createObjectURL(blob)
        resultUrl.value = url
        resultFilename.value = filename
        isSuccess.value = true

        console.log('Zip ready for download', filename)
      } catch (err) {
        console.error('Error handling binary response:', err)
        alert('Erreur lors du traitement de la réponse')
      }
    }
  } catch (err) {
    console.error('Zip upload error:', err)
    alert('Erreur réseau lors de l\'envoi')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="file-selector">
    <div class="input-wrapper">
      <label for="file-input" class="file-label">
        Sélectionner des fichiers
      </label>
      <input
        id="file-input"
        type="file"
        multiple
        @change="handleFileSelect"
        class="file-input"
      />
    </div>

    <div v-if="isSuccess" class="zip-success">
      <h3>Archive prête : {{ resultFilename }}</h3>
      <div class="actions">
        <button @click="downloadResult" class="zip-btn">Télécharger le zip</button>
        <button @click="returnToFiles" class="clear-btn">Retourner aux fichiers</button>
      </div>
    </div>

    <div v-else-if="files.length > 0" class="files-list">
      <h3>Fichiers sélectionnés ({{ files.length }})</h3>
      <ul>
        <li v-for="(file, index) in files" :key="index" class="file-item">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ (file.size / 1024).toFixed(2) }} KB</span>
          <button @click="removeFile(index)" class="remove-btn">×</button>
        </li>
      </ul>
      <div class="actions">
        <button v-if="files.length > 1" @click="clearAll" class="clear-btn">
          Effacer tous les fichiers
        </button>
        <button v-if="files.length > 0" @click="zipFiles" class="zip-btn" :disabled="isLoading">
          {{ isLoading ? 'Zippage...' : 'Zipper' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-selector {
  padding: 2rem;
  border-radius: 8px;
  background-color: #f5f5f5;
}

.input-wrapper {
  margin-bottom: 2rem;
}

.file-label {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background-color: #4caf50;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.3s;
}

.file-label:hover {
  background-color: #45a049;
}

.file-input {
  display: none;
}

.files-list {
  margin-top: 2rem;
}

.files-list h3 {
  margin-bottom: 1rem;
  color: #333;
}

.files-list ul {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background-color: white;
  border-radius: 4px;
  border-left: 4px solid #4caf50;
}

.file-name {
  flex: 1;
  font-weight: 500;
  word-break: break-all;
}

.file-size {
  color: #666;
  margin: 0 1rem;
  font-size: 0.9rem;
}

.remove-btn {
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: background-color 0.3s;
}

.remove-btn:hover {
  background-color: #da190b;
}

.clear-btn {
  padding: 0.5rem 1rem;
  background-color: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.3s;
}

.clear-btn:hover {
  background-color: #e68900;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.zip-btn {
  padding: 0.5rem 1rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.3s;
}

.zip-btn:hover {
  background-color: #135ea6;
}

.zip-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
