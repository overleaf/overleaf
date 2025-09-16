/**
 *
 * @return {Node}
 */
function getLastImport(body) {
  return body.reduce((lastIndex, node, index) => {
    return node.type === 'ImportDeclaration' ? index : lastIndex
  }, -1)
}

module.exports = {
  getLastImport,
}
