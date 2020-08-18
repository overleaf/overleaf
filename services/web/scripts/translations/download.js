const { promises: fs } = require('fs')
const oneSky = require('@brainly/onesky-utils')
const sanitizeHtml = require('sanitize-html')

async function run() {
  try {
    // The recommended OneSky set-up appears to require an API request to
    // generate files on their side, which you could then request and use. We
    // only have 1 such file that appears to be misnamed (en-US, despite our
    // translations being marked as GB) and very out-of-date.
    // However by requesting the "multilingual file" for this file, we get all
    // of the translations
    const content = await oneSky.getMultilingualFile({
      apiKey: process.env.ONE_SKY_PUBLIC_KEY,
      secret: process.env.ONE_SKY_PRIVATE_KEY,
      projectId: '25049',
      fileName: 'en-US.json'
    })
    const json = JSON.parse(content)

    for (const [code, lang] of Object.entries(json)) {
      for (let [key, value] of Object.entries(lang.translation)) {
        // Handle multi-line strings as arrays by joining on newline
        if (Array.isArray(value)) {
          value = value.join('\n')
        }
        lang.translation[key] = sanitize(value)
      }

      await fs.writeFile(
        `../../locales/${code}.json`,
        JSON.stringify(lang.translation, null, 2)
      )
    }

    // Copy files, so we have appropriate dialects
    await fs.copyFile('../../locales/en-GB.json', '../../locales/en-US.json')
    await fs.copyFile('../../locales/en-GB.json', '../../locales/en.json')
    await fs.copyFile('../../locales/zh-CN.json', '../../locales/cn.json')
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
run()

function sanitize(input) {
  return sanitizeHtml(input, {
    allowedTags: ['b', 'strong', 'a', 'code'],
    allowedAttributes: {
      a: ['href', 'class']
    },
    textFilter(text) {
      return text
        .replace(/\{\{/, '&#123;&#123;')
        .replace(/\}\}/, '&#125;&#125;')
    }
  })
}
