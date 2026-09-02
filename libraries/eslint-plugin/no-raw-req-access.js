const RAW_FIELDS = new Set(['body', 'query', 'params'])

function isReqIdentifier(node) {
  return node && node.type === 'Identifier' && node.name === 'req'
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow reading raw request input (req.body/req.query/req.params); validate it with parseReq() instead',
    },
    messages: {
      noRawReqAccess:
        'Do not read req.{{field}} directly; validate request input with parseReq() from @overleaf/validation-tools. Allowlisted infrastructure middleware may use getRawReqInput().',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (!isReqIdentifier(node.object)) return
        const property = node.property
        const field =
          !node.computed && property.type === 'Identifier'
            ? property.name
            : node.computed &&
                property.type === 'Literal' &&
                typeof property.value === 'string'
              ? property.value
              : null
        if (field === null || !RAW_FIELDS.has(field)) return
        // writes stay allowed: body parsers and middleware assign req.body
        const parent = node.parent
        if (
          parent.type === 'AssignmentExpression' &&
          parent.left === node &&
          parent.operator === '='
        ) {
          return
        }
        context.report({ node, messageId: 'noRawReqAccess', data: { field } })
      },
      VariableDeclarator(node) {
        if (!isReqIdentifier(node.init)) return
        if (node.id.type !== 'ObjectPattern') return
        for (const prop of node.id.properties) {
          if (
            prop.type === 'Property' &&
            !prop.computed &&
            prop.key.type === 'Identifier' &&
            RAW_FIELDS.has(prop.key.name)
          ) {
            context.report({
              node: prop,
              messageId: 'noRawReqAccess',
              data: { field: prop.key.name },
            })
          }
        }
      },
    }
  },
}
