const path = require('path')
const { promises: fs } = require('fs')
const oneSky = require('@brainly/onesky-utils')
const { sanitize } = require('./sanitize')
const { withAuth } = require('./config')

async function run() {
  try {
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
        JSON.stringify(lang.translation, null, 2) + '\n'
      )
    }
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
run()
