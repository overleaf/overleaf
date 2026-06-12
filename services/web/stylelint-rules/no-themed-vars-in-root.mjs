import stylelint from 'stylelint'

const ruleName = 'overleaf/no-themed-vars-in-root'

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (variable, prop) =>
    `Unexpected themed variable "${variable}" in the value of "${prop}" inside a ":root" block. ` +
    'The "data-theme" attribute is set on <body>, not <html>, so a themed variable referenced at ' +
    '":root" resolves against <html> (always the dark default) and never follows light mode. Declare ' +
    'this custom property on a descendant selector (e.g. the component container) so the themed ' +
    'variable resolves within the themed subtree.',
})

// Matches var(--foo-themed), capturing the variable name.
const THEMED_VAR_RE = /var\(\s*(--[\w-]*-themed)\s*[,)]/g

/** @type {import('stylelint').Rule} */
const rule = primary => {
  return (root, result) => {
    const validOptions = stylelint.utils.validateOptions(result, ruleName, {
      actual: primary,
      possible: [true, false],
    })
    if (!validOptions || !primary) {
      return
    }

    root.walkRules(node => {
      const targetsRoot = node.selector
        .split(',')
        .map(selector => selector.trim())
        .some(selector => selector === ':root')
      if (!targetsRoot) {
        return
      }

      node.walkDecls(decl => {
        for (const [, variable] of decl.value.matchAll(THEMED_VAR_RE)) {
          stylelint.utils.report({
            result,
            ruleName,
            node: decl,
            word: variable,
            message: messages.rejected(variable, decl.prop),
          })
        }
      })
    })
  }
}

rule.ruleName = ruleName
rule.messages = messages

export default stylelint.createPlugin(ruleName, rule)
