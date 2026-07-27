const Path = require('node:path')

/**
 * Block bare mocha `before()` hooks in Cypress e2e suites.
 *
 * `before()` hooks run once per suite and do NOT re-run when a test retries,
 * while `beforeEach`-based hooks (like `beforeWithReRunOnTestRetry`) do.
 * Mixing the two also changes ordering: all `before()` hooks run ahead of
 * every `beforeEach`, not in source order. This matters in the Server Pro
 * e2e suite, where suites change the server config via `startWith()` while
 * test setup runs in `beforeWithReRunOnTestRetry()`: when a later suite
 * changes the config, both must re-run on retry and in registration order,
 * otherwise a retried test runs against setup or config belonging to a
 * different suite.
 *
 * The autofix rewrites `before(fn)` to `beforeWithReRunOnTestRetry(fn)` and
 * adds the helper import when missing. Configure the helper location (repo
 * root relative, no extension) via the `helperPath` option.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow mocha before() hooks in favor of beforeWithReRunOnTestRetry()',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          helperPath: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noMochaBefore:
        'before() hooks do not re-run when a test retries, so retried tests run against stale setup. Use beforeWithReRunOnTestRetry() instead.',
    },
  },
  create(context) {
    const helperPath = context.options[0]?.helperPath
    let lastImport = null
    let hasHelperImport = false

    function helperImportSpecifier() {
      const absolute = Path.resolve(context.cwd, helperPath)
      let relative = Path.relative(
        Path.dirname(Path.resolve(context.cwd, context.filename)),
        absolute
      )
      relative = relative.split(Path.sep).join('/')
      if (!relative.startsWith('.')) {
        relative = `./${relative}`
      }
      return relative
    }

    return {
      ImportDeclaration(node) {
        lastImport = node
        if (
          node.specifiers.some(
            specifier =>
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.name === 'beforeWithReRunOnTestRetry'
          )
        ) {
          hasHelperImport = true
        }
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'before'
        ) {
          return
        }
        // Only the global mocha hook; skip locally defined/imported `before`
        const variable = context.sourceCode
          .getScope(node)
          .references.find(ref => ref.identifier === node.callee)?.resolved
        if (variable && variable.defs.length > 0) {
          return
        }

        const fixable = node.arguments.length === 1 && helperPath
        context.report({
          node: node.callee,
          messageId: 'noMochaBefore',
          fix: fixable
            ? fixer => {
                const fixes = [
                  fixer.replaceText(node.callee, 'beforeWithReRunOnTestRetry'),
                ]
                if (!hasHelperImport) {
                  const importText = `import { beforeWithReRunOnTestRetry } from '${helperImportSpecifier()}'`
                  fixes.push(
                    lastImport
                      ? fixer.insertTextAfter(lastImport, `\n${importText}`)
                      : fixer.insertTextBeforeRange([0, 0], `${importText}\n`)
                  )
                }
                return fixes
              }
            : undefined,
        })
      },
    }
  },
}
