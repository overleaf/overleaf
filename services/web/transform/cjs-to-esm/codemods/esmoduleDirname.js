module.exports = function transformer(file, api) {
  const j = api.jscodeshift

  return j(file.source)
    .find(j.Identifier, { name: '__dirname' })
    .replaceWith(
      j.memberExpression(
        j.metaProperty(j.identifier('import'), j.identifier('meta')),
        j.identifier('dirname'),
        false
      )
    )
    .toSource()
}
