import Path from 'node:path'
import fs from 'node:fs'
import {
  fetchString,
  fetchJson,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))
const CACHE_IN = Path.join(
  Path.dirname(Path.dirname(Path.dirname(__dirname))),
  'data',
  'learnPages'
)

async function scrape(baseUrl, page) {
  const uri = new URL(baseUrl + '/learn-scripts/api.php')
  uri.search = new URLSearchParams({
    page,
    action: 'parse',
    format: 'json',
    redirects: true,
  }).toString()

  try {
    return await fetchString(uri)
  } catch (err) {
    if (err instanceof RequestFailedError) {
      console.error(err.response.status, page, err.response)
    } else {
      console.error(err)
    }
  }
}

function hash(blob) {
  return crypto.createHash('sha1').update(blob).digest('hex')
}

function getName(page) {
  let enc = encodeURIComponent(page)
  // There are VERY long titles in media wiki.
  // Add percent encoding and they exceed the filename size on my Ubuntu box.
  if (enc.length > 100) {
    enc = enc.slice(0, 100) + hash(page)
  }
  return enc
}

async function scrapeAndCachePage(baseUrl, page) {
  const path = Path.join(CACHE_IN, getName(page) + '.json')
  try {
    return JSON.parse(await fs.promises.readFile(path, 'utf-8'))
  } catch (e) {
    const blob = await scrape(baseUrl, page)
    const parsed = JSON.parse(blob).parse
    if (!parsed) {
      console.error(page, blob)
      throw new Error('bad contents')
    }
    await fs.promises.mkdir(CACHE_IN, { recursive: true })
    await fs.promises.writeFile(path, JSON.stringify(parsed, null, 2), 'utf-8')
    return parsed
  }
}

async function getAllPagesFrom(baseUrl, continueFrom) {
  // https://learn.overleaf.com/learn/Special:ApiSandbox#action=query&format=json&generator=allpages&gapfilterredir=nonredirects
  const uri = new URL(baseUrl + '/learn-scripts/api.php')
  uri.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'allpages',
    // Ignore pages with redirects. We do not want to check page content twice.
    gapfilterredir: 'nonredirects',
    // Bump the default page size of 10.
    gaplimit: 100,
    ...continueFrom,
  }).toString()

  let blob
  try {
    blob = await fetchJson(uri)
  } catch (err) {
    if (err instanceof RequestFailedError) {
      console.error(err.response.status, continueFrom, err.response)
    } else {
      console.error(err)
      throw err
    }
  }
  const nextContinueFrom = blob && blob.continue
  const pagesRaw = (blob && blob.query && blob.query.pages) || {}
  const pages = Object.values(pagesRaw).map(page => page.title)
  return { nextContinueFrom, pages }
}

async function getAllPages(baseUrl) {
  let continueFrom = {}
  let allPages = []
  while (true) {
    const { nextContinueFrom, pages } = await getAllPagesFrom(
      baseUrl,
      continueFrom
    )
    allPages = allPages.concat(pages)
    if (!nextContinueFrom) break
    continueFrom = nextContinueFrom
  }
  return allPages.sort()
}

async function getAllPagesAndCache(baseUrl) {
  const path = Path.join(CACHE_IN, 'allPages.txt')
  try {
    return JSON.parse(await fs.promises.readFile(path, 'utf-8'))
  } catch (e) {
    const allPages = await getAllPages(baseUrl)
    await fs.promises.mkdir(CACHE_IN, { recursive: true })
    await fs.promises.writeFile(path, JSON.stringify(allPages), 'utf-8')
    return allPages
  }
}

export default {
  getAllPagesAndCache,
  scrapeAndCachePage,
}
