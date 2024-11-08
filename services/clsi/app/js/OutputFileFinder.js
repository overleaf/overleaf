const Path = require('node:path')
const fs = require('node:fs')
const { callbackifyMultiResult } = require('@overleaf/promise-utils')

async function walkFolder(compileDir, d, files, allEntries) {
  const dirents = await fs.promises.readdir(Path.join(compileDir, d), {
    withFileTypes: true,
  })
  for (const dirent of dirents) {
    const p = Path.join(d, dirent.name)
    if (dirent.isDirectory()) {
      await walkFolder(compileDir, p, files, allEntries)
      allEntries.push(p + '/')
    } else if (dirent.isFile()) {
      files.push(p)
      allEntries.push(p)
    } else {
      allEntries.push(p)
    }
  }
}

async function findOutputFiles(resources, directory) {
  const files = []
  const allEntries = []
  await walkFolder(directory, '', files, allEntries)

  const incomingResources = new Set(resources.map(resource => resource.path))

  const outputFiles = []
  for (const path of files) {
    if (incomingResources.has(path)) continue
    if (path === '.project-sync-state') continue
    outputFiles.push({
      path,
      type: Path.extname(path).replace(/^\./, '') || undefined,
    })
  }
  return {
    outputFiles,
    allEntries,
  }
}

module.exports = {
  findOutputFiles: callbackifyMultiResult(findOutputFiles, [
    'outputFiles',
    'allEntries',
  ]),
  promises: {
    findOutputFiles,
  },
}
