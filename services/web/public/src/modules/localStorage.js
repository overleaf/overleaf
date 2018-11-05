/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
angular.module('localStorage', []).value('localStorage', function(...args) {
  /*
		localStorage can throw browser exceptions, for example if it is full
		We don't use localStorage for anything critical, on in that case just
		fail gracefully.
		*/
  try {
    return $.localStorage(...Array.from(args || []))
  } catch (e) {
    console.error('localStorage exception', e)
    return null
  }
})
