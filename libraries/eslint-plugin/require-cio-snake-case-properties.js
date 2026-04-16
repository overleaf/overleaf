'use strict'

const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

function isSnakeCase(name) {
  return SNAKE_CASE_RE.test(name)
}

function getStaticKeyName(property) {
  if (property.computed) return null
  if (property.key.type === 'Identifier') return property.key.name
  if (property.key.type === 'Literal' && typeof property.key.value === 'string')
    return property.key.value
  return null
}

/**
 * Check if a node is a call to CustomerIoHandler.updateUserAttributes()
 * and return the attributes argument (2nd argument)
 */
function getUpdateUserAttributesArg(node) {
  if (
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'CustomerIoHandler' &&
    node.callee.property.name === 'updateUserAttributes' &&
    node.arguments[1]?.type === 'ObjectExpression'
  ) {
    return node.arguments[1]
  }
  return null
}

/**
 * Check if a node is a call to Modules[.promises].hooks.fire('setUserProperties', ...)
 * and return the attributes argument (3rd argument)
 */
function getSetUserPropertiesArg(node) {
  const callee = node.callee
  if (callee.type !== 'MemberExpression' || callee.property.name !== 'fire') {
    return null
  }

  // Check first argument is 'setUserProperties'
  if (
    !node.arguments[0] ||
    node.arguments[0].type !== 'Literal' ||
    node.arguments[0].value !== 'setUserProperties'
  ) {
    return null
  }

  // Match: Modules.hooks.fire or Modules.promises.hooks.fire
  const obj = callee.object
  if (obj.type === 'MemberExpression' && obj.property.name === 'hooks') {
    const parent = obj.object
    // Modules.hooks
    if (parent.type === 'Identifier' && parent.name === 'Modules') {
      if (node.arguments[2]?.type === 'ObjectExpression') {
        return node.arguments[2]
      }
    }
    // Modules.promises.hooks
    if (
      parent.type === 'MemberExpression' &&
      parent.property.name === 'promises' &&
      parent.object.type === 'Identifier' &&
      parent.object.name === 'Modules'
    ) {
      if (node.arguments[2]?.type === 'ObjectExpression') {
        return node.arguments[2]
      }
    }
  }

  return null
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce snake_case for Customer.io user property attribute names',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const attrsNode =
          getUpdateUserAttributesArg(node) || getSetUserPropertiesArg(node)
        if (!attrsNode) return

        for (const property of attrsNode.properties) {
          if (property.type === 'SpreadElement') continue

          const keyName = getStaticKeyName(property)
          if (keyName === null) continue // skip computed/dynamic keys

          if (!isSnakeCase(keyName)) {
            context.report({
              node: property.key,
              message: `Customer.io attribute '{{name}}' must be in snake_case.`,
              data: { name: keyName },
            })
          }
        }
      },
    }
  },
}
