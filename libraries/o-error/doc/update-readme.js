#!/usr/bin/env node

const fs = require('fs')
const jsdoc2md = require('jsdoc-to-markdown')
const toc = require('markdown-toc')

const README = 'README.md'
const HEADER = '## OError API Reference'
const FOOTER = '<!-- END API REFERENCE -->'

async function main() {
  const apiDocs = await jsdoc2md.render({ files: 'index.js' })
  const apiDocLines = apiDocs.trim().split(/\r?\n/g)

  // The first few lines don't make much sense when included in the README.
  const apiDocStart = apiDocLines.indexOf('* [OError](#OError)')
  if (apiDocStart === -1) {
    console.error('API docs not in expected format for insertion.')
    process.exit(1)
  }
  apiDocLines.splice(1, apiDocStart - 1)
  apiDocLines.unshift(HEADER, '')

  const readme = await fs.promises.readFile(README, { encoding: 'utf8' })
  const readmeLines = readme.split(/\r?\n/g)

  const apiStart = readmeLines.indexOf(HEADER)
  const apiEnd = readmeLines.indexOf(FOOTER)

  if (apiStart === -1 || apiEnd === -1) {
    console.error('Could not find the API Reference section.')
    process.exit(1)
  }

  Array.prototype.splice.apply(
    readmeLines,
    [apiStart, apiEnd - apiStart].concat(apiDocLines)
  )

  const readmeWithApi = readmeLines.join('\n')

  let readmeWithApiAndToc = toc.insert(readmeWithApi)

  // Unfortunately, the ⇒ breaks the generated TOC links.
  readmeWithApiAndToc = readmeWithApiAndToc.replace(/-%E2%87%92-/g, '--')

  await fs.promises.writeFile(README, readmeWithApiAndToc)
}
main()
