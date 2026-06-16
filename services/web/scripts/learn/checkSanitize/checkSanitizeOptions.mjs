import crypto from 'node:crypto'
import fs from 'node:fs'
import Path from 'node:path'
import cheerio from 'cheerio'
// checkSanitizeOptions is only used in dev env
// eslint-disable-next-line import/no-extraneous-dependencies
import * as prettier from 'prettier'
import sanitizeHtml from 'sanitize-html'
import { sanitizeOptions } from '../../../modules/learn/app/src/sanitizeOptions.mjs'
import { fileURLToPath } from 'node:url'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))
const EXTRACT_STYLE = process.env.EXTRACT_STYLES === 'true'
const OMIT_STYLE = process.env.OMIT_STYLE !== 'false'
const DUMP_CSS_IN = Path.join(
  Path.dirname(Path.dirname(Path.dirname(__dirname))),
  'data',
  'dumpFolder'
)

function hash(blob) {
  return crypto.createHash('sha1').update(blob).digest('hex')
}

function normalize(blob, title) {
  // styles are dropped in web and kept in wiki pages for previewing there.
  blob = blob.replace(/<style>(.+?)<\/style>/gs, (_, match) => {
    if (EXTRACT_STYLE) {
      // normalize css with prettier
      const css = prettier.format(match, { parser: 'css' })
      fs.writeFileSync(
        Path.join(DUMP_CSS_IN, `${hash(css)}-${encodeURIComponent(title)}.css`),
        `/* title: ${title} */\n\n${css}`
      )
    }
    if (OMIT_STYLE) {
      return ''
    }
    return match
  })

  // strip comments:
  // - comment at the bottom of each page
  blob = blob.replace(/<!-- \nNewPP limit report.+/s, '')
  // - annotation of math characters
  blob = blob.replace(/<!-- . -->/g, '')

  // wrap for consistent rendering
  if (blob.indexOf('<html><head>') !== 0) {
    blob = `<html><head>${blob}</head></html>`
  }

  // normalize inline style:
  // - drop trailing ;
  blob = blob.replace(/style="([^"]+);"/g, (_, style) => `style="${style}"`)
  // - normalize whitespace
  blob = blob.replace(
    /style="([^"]+)"/g,
    (_, style) => `style="${style.trim().replace(/([:;])\s+/g, '$1')}"`
  )

  // let cherrio do another pass
  return cheerio.load(blob).html()
}

function toText(blob) {
  return cheerio.load(blob).text()
}

const zoomOut = 50
function peak(content, offset) {
  // show some more content before/after the mismatch
  if (offset > zoomOut) {
    offset -= zoomOut
  }
  // wrap in JSON to escape new line characters
  return JSON.stringify(content.slice(offset, offset + chunkSize + 2 * zoomOut))
}

const chunkSize = 100
function findFirstMismatch(a, b) {
  if (a === b) return a.length
  let i = 0
  while (
    a.length > chunkSize &&
    b.length > chunkSize &&
    a.slice(0, chunkSize) === b.slice(0, chunkSize)
  ) {
    i++
    a = a.slice(chunkSize)
    b = b.slice(chunkSize)
  }
  return i * chunkSize
}

function checkSanitizeOptions(page, title, text) {
  text = normalize(text, title)
  const sanitized = normalize(sanitizeHtml(text, sanitizeOptions))
  if (text === sanitized) return

  const offset = findFirstMismatch(text, sanitized)

  const textToText = toText(text)
  const sanitizedToText = toText(sanitized)
  const offsetText = findFirstMismatch(textToText, sanitizedToText)

  console.error('---')
  console.error('page           :', page)
  console.error('title          :', title)
  console.error('match          :', text === sanitized)
  console.error('toText         :', toText(text) === toText(sanitized))
  console.error('text           :', peak(text, offset))
  console.error('sanitized      :', peak(sanitized, offset))
  console.error('textToText     :', peak(textToText, offsetText))
  console.error('sanitizedToText:', peak(sanitizedToText, offsetText))
}

export default checkSanitizeOptions
