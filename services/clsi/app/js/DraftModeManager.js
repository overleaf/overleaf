const fsPromises = require('node:fs/promises')
const { callbackify } = require('node:util')
const logger = require('@overleaf/logger')

async function injectDraftMode(filename) {
  const content = await fsPromises.readFile(filename, { encoding: 'utf8' })
  const modifiedContent =
    '\\PassOptionsToPackage{draft}{graphicx}\\PassOptionsToPackage{draft}{graphics}' +
    content
  logger.debug(
    {
      content: content.slice(0, 1024), // \documentclass is normally v near the top
      modifiedContent: modifiedContent.slice(0, 1024),
      filename,
    },
    'injected draft class'
  )
  await fsPromises.writeFile(filename, modifiedContent, { encoding: 'utf8' })
}

module.exports = {
  injectDraftMode: callbackify(injectDraftMode),
  promises: { injectDraftMode },
}
