const { promises: fs } = require('fs')
const { promisify } = require('util')
const oneSky = require('@brainly/onesky-utils')
const { withAuth } = require('./config')

const sleep = promisify(setTimeout)

async function uploadLocales() {
  // Docs: https://github.com/onesky/api-documentation-platform/blob/master/resources/file.md#upload---upload-a-file
  const blob = await oneSky.postFile(
    withAuth({
      fileName: 'en-US.json',
      language: 'en-GB',
      format: 'HIERARCHICAL_JSON',
      content: await fs.readFile(`${__dirname}/../../locales/en.json`),
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
    console.error({ task })
    throw new Error('upload failed')
  }
}

async function main() {
  const importId = await uploadLocales()
  await pollUploadStatus(importId)
}

main().catch(error => {
  console.error({ error })
  process.exit(1)
})
