module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Prohibit Trans with no components or values',
    },
  },
  create(context) {
    return {
      'JSXOpeningElement[name.name="Trans"]'(node) {
        const attributes = new Map(
          node.attributes.map(attr => [attr.name.name, attr])
        )

        if (!attributes.has('components')) {
          if (node.parent.children.length > 0) {
            context.report({
              node,
              message: `Trans components must not have child elements`,
            })
          } else if (attributes.has('values')) {
            context.report({
              node,
              message: `Use t('…') when there are no components`,
            })
          } else {
            context.report({
              node,
              message: `Use t('…') when there are no components`,
              fix(fixer) {
                const i18nKey = attributes.get('i18nKey').value.value

                // Note: Prettier can fix indentation
                return fixer.replaceText(node.parent, `{t('${i18nKey}')}`)
              },
            })
          }
        }
      },
    }
  },
}
