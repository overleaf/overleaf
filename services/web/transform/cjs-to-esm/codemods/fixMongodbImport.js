const { getLastImport } = require('./utils')

module.exports = function (fileInfo, api) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)
  const body = root.get().value.program.body

  // Fix mongodb-legacy import
  root
    .find(j.ImportDeclaration, {
      source: { value: 'mongodb-legacy' },
      specifiers: [{ imported: { name: 'ObjectId' } }],
    })
    .forEach(path => {
      // Create new import declaration
      const newImport = j.importDeclaration(
        [j.importDefaultSpecifier(j.identifier('mongodb'))],
        j.literal('mongodb-legacy')
      )

      // Create new constant declaration
      const newConst = j.variableDeclaration('const', [
        j.variableDeclarator(
          j.objectPattern([
            j.property(
              'init',
              j.identifier('ObjectId'),
              j.identifier('ObjectId')
            ),
          ]),
          j.identifier('mongodb')
        ),
      ])

      // Replace the old import with the new import
      j(path).replaceWith(newImport)

      // Insert the new constant declaration after the last import
      const lastImportIndex = getLastImport(body)
      body.splice(lastImportIndex + 1, 0, newConst)
    })

  return root.toSource({
    quote: 'single',
  })
}
