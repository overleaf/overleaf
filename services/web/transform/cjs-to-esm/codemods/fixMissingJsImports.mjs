import path from 'node:path'
import fs from 'node:fs'

/**
 * @param {import('jscodeshift').FileInfo} file
 * @param {import('jscodeshift').API} api
 */
module.exports = function transformer(file, api) {
  const j = api.jscodeshift
  const root = j(file.source)
  let hasChanges = false

  const considerExtensionReplacement = nodePath => {
    const source = nodePath.value.source

    if (
      !source ||
      typeof source.value !== 'string' ||
      !source.value.endsWith('.js')
    ) {
      return
    }

    const importPath = source.value
    const currentDirectory = path.dirname(file.path)

    const jsPath = path.resolve(currentDirectory, importPath)
    if (fs.existsSync(jsPath)) {
      return
    }

    const mjsImportPath = importPath.replace(/\.js$/, '.mjs')
    const mjsPath = path.resolve(currentDirectory, mjsImportPath)

    if (fs.existsSync(mjsPath)) {
      j(nodePath).get('source').replace(j.literal(mjsImportPath))
      hasChanges = true
    }
  }

  const declarationTypes = [
    j.ImportDeclaration,
    j.ExportNamedDeclaration,
    j.ExportAllDeclaration,
  ]

  declarationTypes.forEach(type => {
    root
      .find(type, { source: s => s !== null })
      .forEach(considerExtensionReplacement)
  })

  return hasChanges ? root.toSource({ quote: 'single' }) : null
}
