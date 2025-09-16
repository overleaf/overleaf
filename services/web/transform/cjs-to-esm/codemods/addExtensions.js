const fs = require('node:fs')
const Path = require('node:path')

module.exports = function (fileInfo, api) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)

  // Add extension to relative path imports
  root
    .find(j.ImportDeclaration)
    .filter(path => path.node.source.value.startsWith('.'))
    .forEach(path => {
      const importPath = path.node.source.value
      const fullPathJs = Path.resolve(
        Path.dirname(fileInfo.path),
        `${importPath}.js`
      )
      const fullPathMjs = Path.resolve(
        Path.dirname(fileInfo.path),
        `${importPath}.mjs`
      )

      if (fs.existsSync(fullPathJs)) {
        path.node.source.value = `${importPath}.js`
      } else if (fs.existsSync(fullPathMjs)) {
        path.node.source.value = `${importPath}.mjs`
      }
    })

  return root.toSource({
    quote: 'single',
  })
}
