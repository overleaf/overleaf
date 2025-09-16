/**
 * @typedef {import('jscodeshift').ASTPath} ASTPath
 * @typedef {import('jscodeshift').JSCodeshift} JSCodeshift
 */

const TARGET_CALLER_NAMES = new Set([
  'describe',
  'it',
  'before',
  'beforeEach',
  'after',
  'afterEach',
])

/**
 * Helper function to check if a 'this' expression belongs directly to a given function scope,
 * and not to a nested traditional function defined within that scope.
 * @param {ASTPath<ThisExpression>} thisPath - The path to the 'this' expression.
 * @param {ASTPath<Function>} targetFunctionPath - The path to the target function scope.
 * @param {JSCodeshift} j - The jscodeshift instance.
 * @returns {boolean} - True if 'this' belongs to the target function scope.
 */
function isThisFromScope(thisPath, targetFunctionPath, j) {
  let current = thisPath.parentPath
  while (current && current.node !== targetFunctionPath.node) {
    if (
      (j.FunctionExpression.check(current.node) ||
        j.FunctionDeclaration.check(current.node)) &&
      current.node !== targetFunctionPath.node
    ) {
      return false
    }
    current = current.parentPath
  }
  return !!current && current.node === targetFunctionPath.node
}

module.exports = function transformer(file, api) {
  const j = api.jscodeshift
  const root = j(file.source)

  const functionsToModify = new Set()

  root.find(j.CallExpression).forEach(callPath => {
    const callNode = callPath.node

    if (
      j.Identifier.check(callNode.callee) &&
      TARGET_CALLER_NAMES.has(callNode.callee.name)
    ) {
      callNode.arguments.forEach((arg, index) => {
        if (
          j.FunctionExpression.check(arg) ||
          j.FunctionDeclaration.check(arg)
        ) {
          const functionArgumentPath = callPath.get('arguments', index)
          const containsRelevantThis = j(functionArgumentPath)
            .find(j.ThisExpression)
            .some(thisPath =>
              isThisFromScope(thisPath, functionArgumentPath, j)
            )

          if (containsRelevantThis) {
            functionsToModify.add(functionArgumentPath)
          }
        }
      })
    }
  })

  functionsToModify.forEach((functionPath /*: ASTPath<Function> */) => {
    const functionNode = functionPath.node

    const hasCtxParam = functionNode.params.some(
      param => j.Identifier.check(param) && param.name === 'ctx'
    )
    if (!hasCtxParam) {
      functionNode.params.push(j.identifier('ctx'))
    }

    j(functionPath)
      .find(j.ThisExpression)
      .filter(thisPath => isThisFromScope(thisPath, functionPath, j))
      .replaceWith(j.identifier('ctx'))
  })

  return root.toSource({ quote: 'single' })
}
