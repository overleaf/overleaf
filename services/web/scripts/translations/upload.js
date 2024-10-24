import Path from 'path'
import { promises as fs } from 'fs'
import { promisify } from 'util'
import oneSky from '@brainly/onesky-utils'
import Config from './config.js'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const { withAuth } = Config

const sleep = promisify(setTimeout)

async function uploadLocales() {
  // Docs: https://github.com/onesky/api-documentation-platform/blob/master/resources/file.md#upload---upload-a-file
  const blob = await oneSky.postFile(
    withAuth({
      fileName: 'en-US.json',
      language: 'en-GB',
      format: 'HIERARCHICAL_JSON',
      content: await fs.readFile(
        Path.join(__dirname, '/../../locales/en.json')
      ),
      keepStrings: false, // deprecate locales that no longer exist in en.json
    })
  )
  return JSON.parse(blob).data.import.id
}

async function getImportTask(importId) {
  // Docs: https://github.com/onesky/api-documentation-platform/blob/master/resources/import_task.md
  const blob = await oneSky.getImportTask(withAuth({ importId }))
  return JSON.parse(blob).data
}

async function pollUploadStatus(importId) {
  let task
  while ((task = await getImportTask(importId)).status === 'in-progress') {
    console.log('onesky is processing the import ...')
    await sleep(5000)
  }
  if (task.status === 'failed') {
    console.error(JSON.stringify({ task }, null, 2))
    throw new Error('upload failed')
  }
}

async function uploadOnce() {
  const importId = await uploadLocales()
  await pollUploadStatus(importId)
}

async function main() {
  try {
    await uploadOnce()
  } catch (err) {
    console.error('--- upload failed once ---')
    console.error(err)
    console.error('--- upload failed once ---')
    console.log('retrying upload in 30s')
    await sleep(30_000)
    await uploadOnce()
  }
}

try {
  await main()
} catch (error) {
  console.error({ error })
  process.exit(1)
}
