const DOCS_HOST = 'docs.overleaf.com'
const REQUIRED_REL_TOKENS = ['noopener', 'noreferrer']
// Elements that forward href/target/rel straight onto a rendered <a>.
const LINK_ELEMENT_NAMES = ['a', 'OLButton']

function getStringLiteralValue(node) {
  if (!node) return undefined
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value
  }
  if (
    node.type === 'JSXExpressionContainer' &&
    node.expression.type === 'Literal' &&
    typeof node.expression.value === 'string'
  ) {
    return node.expression.value
  }
  return undefined
}

module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Require rel="noopener noreferrer" on links to docs.overleaf.com that open in a new tab, to prevent reverse-tabnabbing',
    },
    schema: [],
  },
  create(context) {
    const selector = `JSXOpeningElement[name.name=/^(${LINK_ELEMENT_NAMES.join('|')})$/]`

    return {
      [selector](node) {
        const attributes = new Map(
          node.attributes
            .filter(attr => attr.type === 'JSXAttribute')
            .map(attr => [attr.name.name, attr])
        )

        const hrefAttr = attributes.get('href')
        const href = getStringLiteralValue(hrefAttr?.value)
        if (!href || !href.includes(DOCS_HOST)) {
          return
        }

        const targetAttr = attributes.get('target')
        const target = getStringLiteralValue(targetAttr?.value)
        if (!target || target.toLowerCase() !== '_blank') {
          return
        }

        const relAttr = attributes.get('rel')
        const rel = getStringLiteralValue(relAttr?.value) || ''
        const relTokens = rel.toLowerCase().split(/\s+/).filter(Boolean)
        const missingTokens = REQUIRED_REL_TOKENS.filter(
          token => !relTokens.includes(token)
        )

        if (missingTokens.length === 0) {
          return
        }

        context.report({
          node: relAttr || node,
          message:
            'Links to docs.overleaf.com with target="_blank" must have rel="noopener noreferrer" to prevent reverse-tabnabbing.',
          fix(fixer) {
            const newRel = Array.from(
              new Set([...relTokens, ...REQUIRED_REL_TOKENS])
            ).join(' ')

            if (relAttr) {
              if (!relAttr.value) {
                return fixer.replaceText(relAttr, `rel="${newRel}"`)
              }
              return fixer.replaceText(relAttr.value, `"${newRel}"`)
            }

            return fixer.insertTextAfter(targetAttr, ` rel="${newRel}"`)
          },
        })
      },
    }
  },
}
