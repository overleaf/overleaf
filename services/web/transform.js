const path = require('path')

const BASE_PATH = 'frontend/js/'

function getRelativePath(importPath, filePath) {
  // Ignore existing relative paths
  if (importPath.startsWith('.')) {
    return importPath
  }
  // Ignore npm deps (should be absolute)
  if (
    importPath.startsWith('crypto-js') ||
    importPath.startsWith('moment') ||
    importPath.startsWith('algoliasearch')
  ) {
    return importPath
  }
  // Ignore aliased paths (handled specially by webpack)
  if (
    importPath.startsWith('libs/') ||
    importPath.startsWith('ace/') ||
    importPath.startsWith('fineuploader')
  ) {
    return importPath
  }

  const relativePath = path.relative(filePath, `${BASE_PATH}/${importPath}/`)
  // Strip leading dots if importing at same level, because path.relative
  // likes to use ../my-file.js instead of ./my-file.js
  if (/^\.{2}\/\w/.test(relativePath)) {
    return relativePath.substring(1)
  } else {
    return relativePath.substring(3)
  }
}

export default function(file, api) {
  const j = api.jscodeshift
  const filePath = file.path

  return j(file.source)
    .find(j.CallExpression, {
      callee: { name: 'define' }
    })
    .replaceWith(node => {
      const defineArgs = node.get('arguments', 0)

      const deps = defineArgs.get('elements')

      // Ignore files with no deps
      if (!deps.value) {
        return node.value
      }

      const elems = deps.map(e => {
        return j.literal(getRelativePath(e.node.value, filePath))
      })
      const newDeps = j.arrayExpression(elems)

      const callee = node.get('callee').value
      const cb = node.get('arguments', 1).value
      return j.callExpression(callee, [newDeps, cb])
    })
    .toSource()
}
