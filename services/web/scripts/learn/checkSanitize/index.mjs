import checkSanitizeOptions from './checkSanitizeOptions.mjs'
import Scrape from './scrape.mjs'
import { fileURLToPath } from 'node:url'

const { getAllPagesAndCache, scrapeAndCachePage } = Scrape

async function main() {
  const BASE_URL = process.argv.pop()
  if (!BASE_URL.startsWith('http')) {
    throw new Error(
      'Usage: node scripts/learn/checkSanitize/index.mjs https://LEARN_WIKI'
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

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await main()
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
