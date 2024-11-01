// Performs a few useful codemod transformations for Overleaf's esm migration.
// The transformations mostly address specific issues faced commonly in Overleaf's `web` service.
// * Replaces `sandboxed-module` imports with `esmock` imports.
// * Replaces `sandboxed-module` invocation with `esmock` invocation (Assumes `SandboxedModule.require` is used for the invocation).
// * Fixes `mongodb-legacy` import to use `mongodb` import and extract `ObjectId` from the import.
// * Replaces `require('path').join` with `path.join` (importing the path module if not already imported).
// * Adds `const __dirname = fileURLToPath(new URL('.', import.meta.url))` if `__dirname` is used in the file.
// * Adds `.js` or `.mjs` extension (as appropriate) to relative path imports.
// call this with `jscodeshift -t overleaf-es-codemod.js <file>` or using the `cjs-to-esm.js` script (which does this as the final step before formatting).

const fs = require('node:fs')
const Path = require('node:path')

module.exports = function (fileInfo, api) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)
  const body = root.get().value.program.body

  /**
   * Conditionally adds an import statement to the top of the file if it doesn't already exist.
   * @param moduleName A plain text name for the module to import (e.g. 'node:path').
   * @param specifier A jscodeshift specifier for the import statement (provides e.g. `{ promises }` from `import { promises } from 'fs'`.
   * @param existingImportCheck A function that checks if a specific import statement is the one we're looking for.
   */
  function addImport(moduleName, specifier, existingImportCheck) {
    // Add import path from 'path' at the top if not already present
    const importDeclaration = j.importDeclaration(
      specifier,
      j.literal(moduleName)
    )

    if (!existingImportCheck) {
      existingImportCheck = node => node.source.value === moduleName
    }

    const existingImport = body.find(
      node => node.type === 'ImportDeclaration' && existingImportCheck(node)
    )

    if (!existingImport) {
      const lastImportIndex = body.reduce((lastIndex, node, index) => {
        return node.type === 'ImportDeclaration' ? index : lastIndex
      }, -1)
      body.splice(lastImportIndex, 0, importDeclaration)
    }
  }

  // Replace sandboxed-module imports
  root
    .find(j.ImportDeclaration, {
      source: { value: 'sandboxed-module' },
    })
    .forEach(path => {
      path.node.source.value = 'esmock'
      if (path.node.specifiers.length > 0 && path.node.specifiers[0].local) {
        path.node.specifiers[0].local.name = 'esmock'
      }
    })

  // Replace sandboxedModule.require calls with awaited esmock calls
  root
    .find(j.CallExpression, {
      callee: {
        object: { name: 'SandboxedModule' },
        property: { name: 'require' },
      },
    })
    .forEach(path => {
      const args = path.node.arguments
      if (args.length > 0) {
        const firstArg = args[0]
        const esmockArgs = [firstArg]

        // Check if there's a second argument with a 'requires' property
        if (args.length > 1 && args[1].type === 'ObjectExpression') {
          const requiresProp = args[1].properties.find(
            prop =>
              prop.key.name === 'requires' || prop.key.value === 'requires'
          )

          if (requiresProp) {
            // Move contents of 'requires' to top level
            esmockArgs.push(requiresProp.value)
          }
        }

        // Create the await expression with restructured arguments
        const awaitExpression = j.awaitExpression(
          j.callExpression(
            j.memberExpression(j.identifier('esmock'), j.identifier('strict')),
            esmockArgs
          )
        )

        // Replace the original call with the await expression
        j(path).replaceWith(awaitExpression)

        // Find the closest function and make it async
        let functionPath = path
        while ((functionPath = functionPath.parent)) {
          if (
            functionPath.node.type === 'FunctionDeclaration' ||
            functionPath.node.type === 'FunctionExpression' ||
            functionPath.node.type === 'ArrowFunctionExpression'
          ) {
            functionPath.node.async = true
            break
          }
        }
      }
    })

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

      // Replace the old import with the new import and constant declaration
      j(path).replaceWith(newImport)
      path.insertAfter(newConst)
    })

  root
    .find(j.CallExpression, {
      callee: {
        object: { callee: { name: 'require' }, arguments: [{ value: 'path' }] },
        property: { name: 'join' },
      },
    })
    .forEach(path => {
      // Replace with path.join
      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(j.identifier('path'), j.identifier('join')),
          path.node.arguments
        )
      )

      // Add import path from 'path' at the top if not already presen
      addImport(
        'node:path',
        [j.importDefaultSpecifier(j.identifier('path'))],
        node =>
          node.source.value === 'path' || node.source.value === 'node:path'
      )
    })

  // Add const __dirname = fileURLToPath(new URL('.', import.meta.url)) if there is a usage of __dirname
  const dirnameDeclaration = j.variableDeclaration('const', [
    j.variableDeclarator(
      j.identifier('__dirname'),
      j.callExpression(j.identifier('fileURLToPath'), [
        j.newExpression(j.identifier('URL'), [
          j.literal('.'),
          j.memberExpression(j.identifier('import'), j.identifier('meta.url')),
        ]),
      ])
    ),
  ])

  const existingDirnameDeclaration = body.find(
    node =>
      node.type === 'VariableDeclaration' &&
      node.declarations[0].id.name === '__dirname'
  )
  const firstDirnameUsage = root.find(j.Identifier, { name: '__dirname' }).at(0)

  if (firstDirnameUsage.size() > 0 && !existingDirnameDeclaration) {
    // Add import path from 'path' at the top if not already present
    addImport(
      'node:url',
      [j.importSpecifier(j.identifier('fileURLToPath'))],
      node => node.source.value === 'url' || node.source.value === 'node:url'
    )

    const lastImportIndex = body.reduce((lastIndex, node, index) => {
      return node.type === 'ImportDeclaration' ? index : lastIndex
    }, -1)

    body.splice(lastImportIndex + 1, 0, dirnameDeclaration)
  }

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
