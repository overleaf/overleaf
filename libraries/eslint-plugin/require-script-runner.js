module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require Script Runner for scripts',
    },
  },
  create(context) {
    let hasImport = false

    return {
      ImportDeclaration(node) {
        if (node.source.value.endsWith('lib/ScriptRunner.mjs')) {
          hasImport = true
        }
      },
      'Program:exit'() {
        if (!hasImport) {
          context.report({
            loc: { line: 1, column: 0 },
            message:
              'Please use Script Runner for scripts. Refer to the developer manual (https://manual.dev-overleaf.com/development/code/web_scripts/#monitor-script-execution-and-usage-with-script-runner) for more information.',
          })
        }
      },
    }
  },
}
