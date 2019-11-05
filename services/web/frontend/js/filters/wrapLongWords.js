/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  const DEF_MIN_LENGTH = 20

  const _decodeHTMLEntities = str =>
    str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))

  const _getWrappedWordsString = function(baseStr, wrapperElName, minLength) {
    let outputStr
    minLength = minLength || DEF_MIN_LENGTH
    const words = baseStr.split(' ')

    const wordsWrapped = Array.from(words).map(
      word =>
        _decodeHTMLEntities(word).length >= minLength
          ? `<${wrapperElName} class=\"break-word\">${word}</${wrapperElName}>`
          : word
    )

    return (outputStr = wordsWrapped.join(' '))
  }

  return App.filter('wrapLongWords', () => (input, minLength) =>
    _getWrappedWordsString(input, 'span', minLength)
  )
})
