// Reject runs of two or more consecutive whitespace characters in JSON string
// values. Catches ASCII spaces, NBSP, NNBSP, tabs, and other Unicode whitespace.

const CONSECUTIVE_WHITESPACE = /\s{2,}/

module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Disallow runs of two or more consecutive whitespace characters in JSON string values (typically locale files).',
    },
    schema: [],
    messages: {
      consecutiveSpaces:
        'Locale value contains a run of consecutive whitespace. Collapse to a single space.',
    },
  },
  create(context) {
    return {
      Member(node) {
        if (node.value.type !== 'String') return
        const original = node.value.value
        if (!CONSECUTIVE_WHITESPACE.test(original)) return
        const fixed = original.replace(/\s{2,}/g, ' ')
        context.report({
          node: node.value,
          messageId: 'consecutiveSpaces',
          fix(fixer) {
            return fixer.replaceText(node.value, JSON.stringify(fixed))
          },
        })
      },
    }
  },
}
