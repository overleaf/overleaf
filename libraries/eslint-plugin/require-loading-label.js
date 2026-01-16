module.exports = {
  meta: {
    type: 'problem',
    fixable: null,
    docs: {
      description:
        'Require loadingLabel prop when isLoading is specified on OLButton',
    },
    schema: [],
  },
  create(context) {
    return {
      'JSXOpeningElement[name.name="OLButton"]'(node) {
        const attributes = new Map(
          node.attributes.map(attr => [attr.name?.name, attr])
        )

        const isLoadingAttr = attributes.get('isLoading')
        const loadingLabelAttr = attributes.get('loadingLabel')

        if (isLoadingAttr && !loadingLabelAttr) {
          const isLoadingValue = isLoadingAttr.value

          if (
            !isLoadingValue ||
            (isLoadingValue.type === 'JSXExpressionContainer' &&
              isLoadingValue.expression.type === 'Literal' &&
              isLoadingValue.expression.value === true)
          ) {
            context.report({
              node: isLoadingAttr,
              message:
                'Button with isLoading prop must also specify loadingLabel',
            })
          } else if (
            isLoadingValue.type === 'JSXExpressionContainer' &&
            isLoadingValue.expression.type !== 'Literal'
          ) {
            context.report({
              node: isLoadingAttr,
              message:
                'Button with isLoading prop must also specify loadingLabel',
            })
          }
        }
      },
    }
  },
}
