/**
 * @typedef {import('jscodeshift').FileInfo} FileInfo
 * @typedef {import('jscodeshift').API} API
 * @typedef {import('jscodeshift').Collection} Collection
 */

module.exports = function transformer(file, api) {
  const j = api.jscodeshift
  const root = j(file.source)

  const mochaFunctionNames = new Set([
    'it',
    'specify',
    'before',
    'after',
    'beforeEach',
    'afterEach',
  ])

  root
    .find(j.CallExpression, {
      callee: {
        type: 'Identifier',
        name: name => mochaFunctionNames.has(name),
      },
    })
    .forEach(path => {
      let callbackFunctionArg = null
      let funcArgIndex = -1

      for (let i = path.node.arguments.length - 1; i >= 0; i--) {
        const arg = path.node.arguments[i]
        if (
          arg &&
          (arg.type === 'FunctionExpression' ||
            arg.type === 'ArrowFunctionExpression')
        ) {
          callbackFunctionArg = arg
          funcArgIndex = i
          break
        }
      }

      if (!callbackFunctionArg) {
        return
      }

      if (callbackFunctionArg.async) {
        return
      }

      const params = callbackFunctionArg.params
      if (!params || params.length === 0) {
        return
      }

      const lastParam = params[params.length - 1]
      if (
        !lastParam ||
        lastParam.type !== 'Identifier' ||
        lastParam.name !== 'done'
      ) {
        return
      }

      const doneParamName = lastParam.name

      callbackFunctionArg.params.pop()

      const originalBody = callbackFunctionArg.body

      const bodyCollection = j(originalBody)
      bodyCollection
        .find(j.Identifier, { name: doneParamName })
        .forEach(identifierPath => {
          const parentNode = identifierPath.parentPath.node
          if (
            parentNode.type === 'MemberExpression' &&
            parentNode.property === identifierPath.node &&
            !parentNode.computed
          ) {
            return
          }

          if (
            parentNode.type === 'Property' &&
            parentNode.key === identifierPath.node &&
            !parentNode.shorthand
          ) {
            return
          }

          if (
            parentNode.type === 'LabeledStatement' &&
            parentNode.label === identifierPath.node
          ) {
            return
          }

          identifierPath.node.name = 'resolve'
        })

      const resolveIdentifier = j.identifier('resolve')
      let newBodyBlock

      if (originalBody.type === 'BlockStatement') {
        newBodyBlock = originalBody
      } else {
        newBodyBlock = j.blockStatement([j.expressionStatement(originalBody)])
      }

      const promiseCallback = j.arrowFunctionExpression(
        [resolveIdentifier],
        newBodyBlock,
        false
      )
      promiseCallback.async = false

      const newPromiseExpression = j.newExpression(j.identifier('Promise'), [
        promiseCallback,
      ])

      const newFunctionBody = j.expressionStatement(
        j.awaitExpression(newPromiseExpression)
      )

      callbackFunctionArg.body = j.blockStatement([newFunctionBody])

      callbackFunctionArg.async = true

      console.log(
        `Transformed function in ${file.path} (argument ${funcArgIndex} of ${path.node.callee.name})`
      )
    })

  return root.toSource({ quote: 'single' })
}
