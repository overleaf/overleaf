module.exports = function (fileInfo, api) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)
  let shouldAddViImport = false
  let shouldRemoveSandboxedModule = false

  root
    .find(j.CallExpression, {
      callee: {
        object: { name: 'SandboxedModule' },
        property: { name: 'require' },
      },
    })
    .forEach(path => {
      shouldRemoveSandboxedModule = true
      const args = path.node.arguments
      if (args.length > 0) {
        const assignmentStatement = path.parentPath.parentPath
        const firstArg = args[0]

        // Check if there's a second argument with a 'requires' property
        if (args.length > 1 && args[1].type === 'ObjectExpression') {
          const requiresProp = args[1].properties.find(
            prop =>
              prop.key.name === 'requires' || prop.key.value === 'requires'
          )

          if (requiresProp) {
            shouldAddViImport = true

            const mocks = requiresProp.value.properties.map(mock => {
              const depPath =
                mock.key.type === 'Literal' ? mock.key.value : mock.key.name
              return j.expressionStatement(
                j.callExpression(j.identifier('vi.doMock'), [
                  j.literal(depPath),
                  j.arrowFunctionExpression(
                    [],
                    j.objectExpression([
                      j.objectProperty(j.identifier('default'), mock.value),
                    ])
                  ),
                ])
              )
            })

            j(assignmentStatement).insertBefore(mocks)
          }
        }

        // Create an expression to await the import of the module under test
        const awaitExpression = j.memberExpression(
          j.awaitExpression(
            j.callExpression(j.identifier('import'), [firstArg])
          ),
          j.identifier('default')
        )

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

  const alreadyHasViImport =
    root
      .find(j.ImportDeclaration, {
        source: { value: 'vitest' },
      })
      .size() > 0

  if (shouldAddViImport && !alreadyHasViImport) {
    root
      .get()
      .node.program.body.unshift(
        j.importDeclaration(
          [j.importSpecifier(j.identifier('vi'))],
          j.literal('vitest')
        )
      )
  }

  if (shouldRemoveSandboxedModule) {
    root
      .find(j.ImportDeclaration, {
        source: { value: 'sandboxed-module' },
      })
      .remove()
  }

  return root.toSource({
    quote: 'single',
  })
}
