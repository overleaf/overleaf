import path from 'path'
import { promises as fs } from 'fs'
import oneSky from '@brainly/onesky-utils'
import Sanitize from './sanitize.js'
import Config from './config.js'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const { sanitize } = Sanitize
const { withAuth } = Config

async function run() {
  // The recommended OneSky set-up appears to require an API request to
  // generate files on their side, which you could then request and use. We
  // only have 1 such file that appears to be misnamed (en-US, despite our
  // translations being marked as GB) and very out-of-date.
  // However by requesting the "multilingual file" for this file, we get all
  // of the translations
  const content = await oneSky.getMultilingualFile(
    withAuth({
      fileName: 'en-US.json',
    })
  )
  const json = JSON.parse(content)

  for (const [code, lang] of Object.entries(json)) {
    if (code === 'en-GB') {
      // OneSky does not have read-after-write consistency.
      // Skip the dump of English locales, which may not include locales
      //  that were just uploaded.
      continue
    }

    for (let [key, value] of Object.entries(lang.translation)) {
      // Handle multi-line strings as arrays by joining on newline
      if (Array.isArray(value)) {
        value = value.join('\n')
      }
      lang.translation[key] = sanitize(value)
    }

    await fs.writeFile(
      path.join(__dirname, `/../../locales/${code}.json`),
      JSON.stringify(
        lang.translation,
        Object.keys(lang.translation).sort(),
        2
      ) + '\n'
    )
  }
}

try {
  await run()
} catch (error) {
  console.error(error)
  process.exit(1)
}
