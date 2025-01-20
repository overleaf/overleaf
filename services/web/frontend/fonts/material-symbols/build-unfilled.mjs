import path from 'node:path'
import fs from 'node:fs/promises'
import icons from './unfilled-symbols.mjs'

const iconList = [...new Set(icons)].sort().map(encodeURIComponent).join(',')

const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20,400,0,0&icon_names=${iconList}&display=block`
console.log(`Fetching font configuration from ${url}`)

const cssFile = await (
  await fetch(url, {
    headers: {
      // Specify a user agent to get a woff2 file
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  })
).text()

const woff2UrlText = cssFile.match(/url\(([^)]+)\) format\('woff2'\)/)?.[1]

if (!woff2UrlText) {
  throw new Error(
    'Could not find woff2 URL in CSS file, try accessing the font configuration URL to check whether an error is reported'
  )
}

const woff2Url = new URL(woff2UrlText)
if (woff2Url.protocol !== 'https:') {
  throw new Error(`Expected HTTPS URL, got ${woff2Url.protocol}`)
}
if (woff2Url.hostname !== 'fonts.gstatic.com') {
  throw new Error(
    `Expected to download font from fonts.gstatic.com, got ${woff2Url.hostname}`
  )
}

console.log(`Fetching woff2 file: ${woff2Url}`)

const outputPath = path.join(
  import.meta.dirname,
  'MaterialSymbolsRoundedUnfilledPartialSlice.woff2'
)

const res = await fetch(woff2Url)

console.log(`Saving font file to ${outputPath}`)
await fs.writeFile(outputPath, res.body)
