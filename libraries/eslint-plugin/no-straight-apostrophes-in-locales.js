// Reject straight apostrophes (') in JSON string values. Straight apostrophes
// in Angular templates can lead to XSS; use the right single quotation mark
// ’ (U+2019) instead. See https://github.com/overleaf/issues/issues/4478

module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Disallow straight apostrophes in JSON string values (typically locale files).',
    },
    schema: [],
    messages: {
      straightApostrophe:
        "Locale value contains a straight apostrophe ('). Use the right single quotation mark ’ (U+2019) instead.",
    },
  },
  create(context) {
    return {
      Member(node) {
        if (node.value.type !== 'String') return
        const original = node.value.value
        if (!original.includes("'")) return
        const fixed = original.replace(/'/g, '’')
        context.report({
          node: node.value,
          messageId: 'straightApostrophe',
          fix(fixer) {
            return fixer.replaceText(node.value, JSON.stringify(fixed))
          },
        })
      },
    }
  },
}
