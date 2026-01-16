const path = require('node:path')
const fs = require('node:fs')

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure vi.doMock first argument is a resolvable path.',
      category: 'Best Practices',
      recommended: false,
      url: '',
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [],
    messages: {
      unresolvablePath:
        'The path "{{pathValue}}" in vi.doMock() cannot be resolved relative to the current file.',
      notAStringLiteral:
        'The first argument of vi.doMock() must be (or resolve to) a string literal representing a path.',
      noArguments: 'vi.doMock() called with no arguments.',
    },
  },
  create(context) {
    const currentFilePath = context.getFilename()
    // ESLint can sometimes pass <text> or <input> for snippets not in a file
    if (currentFilePath === '<text>' || currentFilePath === '<input>') {
      return {}
    }
    const currentDirectory = path.dirname(currentFilePath)

    function canResolve(modulePath) {
      try {
        require.resolve(path.resolve(currentDirectory, modulePath))
        return true
      } catch (e) {
        const absolutePath = path.resolve(currentDirectory, modulePath)
        const extensions = [
          '',
          '.js',
          '.mjs',
          '.ts',
          '.jsx',
          '.tsx',
          '.json',
          '.node',
          '/index.js',
          '/index.ts',
        ] // Add common extensions
        for (const ext of extensions) {
          if (fs.existsSync(absolutePath + ext)) {
            return true
          }
        }
        return false
      }
    }

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'vi' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'doMock'
        ) {
          if (node.arguments.length === 0) {
            context.report({
              node,
              messageId: 'noArguments',
            })
            return
          }

          const firstArg = node.arguments[0]
          let pathValue = firstArg.value

          if (
            firstArg.type !== 'Literal' ||
            typeof firstArg.value !== 'string'
          ) {
            if (firstArg.type === 'Identifier') {
              const variable = context
                .getScope()
                .variables.find(v => v.name === firstArg.name)
              if (
                variable &&
                variable.defs.length > 0 &&
                variable.defs[0].node.init &&
                variable.defs[0].node.init.type === 'Literal' &&
                typeof variable.defs[0].node.init.value === 'string'
              ) {
                pathValue = variable.defs[0].node.init.value
                if (canResolve(pathValue)) {
                  return
                }
                // If the first argument was a variable that didn't resolve then we can't auto-fix it
              }
            }
            context.report({
              node: firstArg,
              messageId: 'notAStringLiteral',
            })
            return
          }

          if (!pathValue.startsWith('.')) {
            return
          }

          if (!canResolve(pathValue)) {
            const mjsPath = pathValue.replace('.js', '.mjs')
            const additionalReportOptions = {}
            if (canResolve(mjsPath)) {
              additionalReportOptions.fix = fixer =>
                fixer.replaceText(firstArg, `'${mjsPath}'`)
              additionalReportOptions.suggest = [
                {
                  desc: `Replace with "${pathValue.replace('.js', '.mjs')}"`,
                  fix: fixer => fixer.replaceText(firstArg, `'${mjsPath}'`),
                },
              ]
            }
            context.report({
              node: firstArg,
              messageId: 'unresolvablePath',
              data: {
                pathValue,
              },
              ...additionalReportOptions,
            })
          }
        }
      },
    }
  },
}
