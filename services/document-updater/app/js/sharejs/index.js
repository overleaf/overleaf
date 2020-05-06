// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const register = function (file) {
  const type = require(file)
  exports[type.name] = type
  try {
    return require(`${file}-api`)
  } catch (error) {}
}

// Import all the built-in types.
register('./simple')
register('./count')

register('./text')
register('./text-composable')
register('./text-tp2')

register('./json')
