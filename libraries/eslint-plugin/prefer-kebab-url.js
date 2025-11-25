const _ = require('lodash')
const { ignoreWords } = require('./prefer-kebab-url-ignore')

const removeTextBetweenBrackets = text => {
  while (text.includes('[') || text.includes('(')) {
    text = text.replaceAll(/\[[^[\]]*]/g, '')
    text = text.replaceAll(/\([^()]*\)/g, '')
  }
  return text
}

const shouldIgnoreWord = str =>
  str.includes(':') ||
  str.includes('(') ||
  str === '*' ||
  str.match(/^[a-z0-9.]+$/) ||
  ignoreWords.snake.has(str) ||
  ignoreWords.camel.has(str) ||
  ignoreWords.other.has(str)

const getSuggestion = routePath => {
  if (typeof routePath === 'string') {
    const kebabed = routePath
      .split('/')
      .map(word => (shouldIgnoreWord(word) ? word : _.kebabCase(word)))
      .join('/')
    return kebabed === routePath ? null : `'${kebabed}'`
  }

  if (routePath instanceof RegExp) {
    const words = removeTextBetweenBrackets(routePath.source).match(/[\w-]+/g)
    if (!words) return routePath

    let newSource = routePath.source
    for (const word of words) {
      if (!shouldIgnoreWord(word)) {
        newSource = newSource.replaceAll(
          new RegExp(`\\b${word}\\b`, 'g'),
          _.kebabCase(word)
        )
      }
    }

    const kebabed = new RegExp(newSource, routePath.flags)
    return kebabed.source.toString() === routePath.source.toString()
      ? null
      : kebabed
  }
}

module.exports = {
  meta: {
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description: 'Enforce using kebab-case for URL paths',
    },
  },
  create: context => ({
    CallExpression(node) {
      if (
        node.callee.type === 'MemberExpression' &&
        node.arguments[0]?.type === 'Literal' &&
        [/app/i, /router/i].some(callee =>
          typeof callee === 'string'
            ? node.callee.object.name === callee
            : callee.test(node.callee.object.name)
        ) &&
        ['get', 'post', 'put', 'delete'].includes(node.callee.property.name)
      ) {
        const routePath = node.arguments[0].value

        const suggestion = getSuggestion(routePath)

        if (suggestion) {
          context.report({
            node: node.arguments[0],
            message: 'Route path should be in kebab-case.',
            suggest: [
              {
                desc: `Change to kebab-case: ${suggestion}`,
                fix: fixer => fixer.replaceText(node.arguments[0], suggestion),
              },
            ],
          })
        }
      }
    },
  }),
}
