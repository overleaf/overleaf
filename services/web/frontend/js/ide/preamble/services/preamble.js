/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.factory('preamble', function(ide) {
    var Preamble = {
      getPreambleText() {
        const text = ide.editorManager.getCurrentDocValue().slice(0, 5000)
        const preamble =
          __guard__(text.match(/([^]*)^\\begin\{document\}/m), x => x[1]) || ''
        return preamble
      },

      getGraphicsPaths() {
        let match
        const preamble = Preamble.getPreambleText()
        const graphicsPathsArgs =
          __guard__(preamble.match(/\\graphicspath\{(.*)\}/), x => x[1]) || ''
        const paths = []
        const re = /\{([^}]*)\}/g
        while ((match = re.exec(graphicsPathsArgs))) {
          paths.push(match[1])
        }
        return paths
      }
    }

    return Preamble
  }))

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
