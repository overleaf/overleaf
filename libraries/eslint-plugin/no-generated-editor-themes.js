module.exports = {
  meta: {
    type: 'error',
    docs: {
      description:
        'Prohibit CodeMirror themes that are generated in a function',
    },
  },
  create(context) {
    return {
      ':matches(ArrowFunctionExpression, FunctionDeclaration, FunctionExpression) CallExpression > MemberExpression[object.name="EditorView"]:matches([property.name="theme"],[property.name="baseTheme"])'(
        node
      ) {
        context.report({
          node,
          message: `EditorView.theme and EditorView.baseTheme each add CSS to the page for every instance of the theme. Store the theme in a variable and reuse it instead.`,
        })
      },
    }
  },
}
