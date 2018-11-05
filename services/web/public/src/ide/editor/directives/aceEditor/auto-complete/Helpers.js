/* eslint-disable
    max-len,
    no-cond-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['ace/ace', 'ace/ext-language_tools'], function() {
  const { Range } = ace.require('ace/range')

  var Helpers = {
    getLastCommandFragment(lineUpToCursor) {
      let index
      if ((index = Helpers.getLastCommandFragmentIndex(lineUpToCursor)) > -1) {
        return lineUpToCursor.slice(index)
      } else {
        return null
      }
    },

    getLastCommandFragmentIndex(lineUpToCursor) {
      // This is hack to let us skip over commands in arguments, and
      // go to the command on the same 'level' as us. E.g.
      //    \includegraphics[width=\textwidth]{..
      // should not match the \textwidth.
      let m
      const blankArguments = lineUpToCursor.replace(/\[([^\]]*)\]/g, args =>
        Array(args.length + 1).join('.')
      )
      if ((m = blankArguments.match(/(\\[^\\]*)$/))) {
        return m.index
      } else {
        return -1
      }
    },

    getCommandNameFromFragment(commandFragment) {
      return __guard__(
        commandFragment != null
          ? commandFragment.match(/\\(\w+)\{/)
          : undefined,
        x => x[1]
      )
    },

    getContext(editor, pos) {
      const upToCursorRange = new Range(pos.row, 0, pos.row, pos.column)
      const lineUpToCursor = editor.getSession().getTextRange(upToCursorRange)
      const commandFragment = Helpers.getLastCommandFragment(lineUpToCursor)
      const commandName = Helpers.getCommandNameFromFragment(commandFragment)
      const beyondCursorRange = new Range(pos.row, pos.column, pos.row, 99999)
      const lineBeyondCursor = editor
        .getSession()
        .getTextRange(beyondCursorRange)
      return {
        lineUpToCursor,
        commandFragment,
        commandName,
        lineBeyondCursor
      }
    }
  }

  return Helpers
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
