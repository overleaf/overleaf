import stylelint from 'stylelint'

const ruleName = 'overleaf/themed-custom-property-suffix'

const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: prop =>
    `Custom property "${prop}" must be suffixed with "-themed" (e.g. --bg-secondary-themed), ` +
    'since this file defines theme-dependent variables.',
})

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

    // Only the declared property name is checked, never var() usages in the
    // value, so referencing non-themed tokens (e.g. var(--bg-dark-primary)) is fine.
    root.walkDecls(decl => {
      if (!decl.prop.startsWith('--') || decl.prop.endsWith('-themed')) {
        return
      }
      stylelint.utils.report({
        result,
        ruleName,
        node: decl,
        word: decl.prop,
        message: messages.rejected(decl.prop),
      })
    })
  }
}

rule.ruleName = ruleName
rule.messages = messages

export default stylelint.createPlugin(ruleName, rule)
