// @ts-check

/**
 * @param {import('jscodeshift').FileInfo} file
 * @param {import('jscodeshift').API} api
 */
module.exports = function transformer(file, api) {
  const j = api.jscodeshift
  const root = j(file.source)

  const chaiImportCollection = root.find(j.ImportDeclaration, {
    source: {
      value: 'chai',
    },
  })

  if (chaiImportCollection.length === 0) {
    return root.toSource()
  }

  const chaiImport = chaiImportCollection.get(0).node
  const chaiSpecifiers = chaiImport.specifiers

  if (!chaiSpecifiers || chaiSpecifiers.length === 0) {
    return root.toSource()
  }

  const vitestImportCollection = root.find(j.ImportDeclaration, {
    source: {
      value: 'vitest',
    },
  })

  if (vitestImportCollection.length > 0) {
    const vitestImport = vitestImportCollection.get(0).node

    const existingVitestSpecifierNames = new Set(
      vitestImport.specifiers.map(specifier => specifier.imported.name)
    )

    const newSpecifiers = chaiSpecifiers.filter(
      specifier => !existingVitestSpecifierNames.has(specifier.imported.name)
    )

    if (newSpecifiers.length > 0) {
      vitestImport.specifiers.push(...newSpecifiers)
    }

    chaiImportCollection.remove()
  } else {
    chaiImport.source.value = 'vitest'
  }

  return root.toSource({ quote: 'single' })
}
