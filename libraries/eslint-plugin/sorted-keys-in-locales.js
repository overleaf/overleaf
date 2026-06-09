// Enforce alphabetically sorted top-level keys in JSON files.

module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Require top-level keys to be sorted alphabetically in JSON files (typically locale files).',
    },
    schema: [],
    messages: {
      unsorted:
        'Top-level keys are not sorted alphabetically. Key "{{key}}" should come before "{{predecessor}}".',
    },
  },
  create(context) {
    return {
      'Document > Object'(node) {
        const members = node.members
        for (let i = 1; i < members.length; i++) {
          const prev = members[i - 1].name.value
          const curr = members[i].name.value
          if (curr < prev) {
            const text = context.sourceCode.text
            const parsed = JSON.parse(text)
            const sortedKeys = Object.keys(parsed).sort()
            const sorted = JSON.stringify(parsed, sortedKeys, 2) + '\n'
            context.report({
              node: members[i],
              messageId: 'unsorted',
              data: { key: curr, predecessor: prev },
              fix(fixer) {
                return fixer.replaceTextRange([0, text.length], sorted)
              },
            })
            return // one violation per file is enough; the fix re-sorts everything
          }
        }
      },
    }
  },
}
