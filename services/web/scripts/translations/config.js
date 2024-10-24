import fs from 'fs'
import Path from 'path'
import { fileURLToPath } from 'url'
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ONESKY_SETTING_PATH = Path.join(__dirname, '../../data/onesky.json')
let userOptions
try {
  userOptions = JSON.parse(fs.readFileSync(ONESKY_SETTING_PATH))
} catch (err) {
  if (err.code !== 'ENOENT') throw err
  if (!process.env.ONE_SKY_PUBLIC_KEY) {
    console.error(
      'Cannot detect onesky credentials.\n\tDevelopers: see the docs at',
      'https://github.com/overleaf/developer-manual/blob/master/code/translations.md#testing-translations-scripts',
      '\n\tOps: environment variable ONE_SKY_PUBLIC_KEY is not set'
    )
    process.exit(1)
  }
}

function withAuth(options) {
  return Object.assign(
    options,
    {
      apiKey: process.env.ONE_SKY_PUBLIC_KEY,
      secret: process.env.ONE_SKY_PRIVATE_KEY,
      projectId: '25049',
    },
    userOptions
  )
}

export default {
  withAuth,
}
