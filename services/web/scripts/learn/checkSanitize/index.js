const { checkSanitizeOptions } = require('./checkSanitizeOptions')
const { getAllPagesAndCache, scrapeAndCachePage } = require('./scrape')

async function main() {
  const BASE_URL = process.argv.pop()
  if (!BASE_URL.startsWith('http')) {
    throw new Error(
      'Usage: node scripts/learn/checkSanitize https://LEARN_WIKI'
    )
  }

  const pages = await getAllPagesAndCache(BASE_URL)

  for (const page of pages) {
    try {
      const parsed = await scrapeAndCachePage(BASE_URL, page)

      const title = parsed.title
      const text = parsed.text ? parsed.text['*'] : ''

      checkSanitizeOptions(page, title, text)
    } catch (e) {
      console.error('---')
      console.error(page, e)
      throw e
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
