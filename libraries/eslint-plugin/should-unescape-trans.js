module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Ensure that Trans with values has shouldUnescape',
    },
  },
  create(context) {
    return {
      'JSXOpeningElement[name.name="Trans"]'(node) {
        const attributes = new Map(
          node.attributes.map(attr => [attr.name.name, attr])
        )

        if (attributes.has('values') && !attributes.has('shouldUnescape')) {
          context.report({
            node,
            message: 'Trans with values must have shouldUnescape',
            fix(fixer) {
              return fixer.insertTextAfter(
                attributes.get('values'),
                '\nshouldUnescape' // Note: Prettier can fix indentation
              )
            },
          })
        }

        if (attributes.has('values') && attributes.has('shouldUnescape')) {
          const tOptions = attributes.get('tOptions')
          if (!tOptions) {
            context.report({
              node,
              message:
                'Trans with shouldUnescape must have tOptions.interpolation.escapeValue',
              fix(fixer) {
                return fixer.insertTextAfter(
                  attributes.get('shouldUnescape'),
                  '\ntOptions={{ interpolation: { escapeValue: true } }}' // Note: Prettier can fix indentation
                )
              },
            })
          } else {
            const property = tOptions.value.expression.properties
              .find(p => p.key.name === 'interpolation')
              ?.value.properties.find(p => p.key.name === 'escapeValue')

            if (property?.value.value !== true) {
              context.report({
                node,
                message:
                  'Trans with shouldUnescape must have tOptions.interpolation.escapeValue set to true',
              })
            }
          }
        }
      },
    }
  },
}
