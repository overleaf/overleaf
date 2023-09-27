import { debugConsole } from '@/utils/debugging'

angular.module('localStorage', []).value('localStorage', localStorage)

/*
  localStorage can throw browser exceptions, for example if it is full
  We don't use localStorage for anything critical, on in that case just
  fail gracefully.
*/
function localStorage(...args) {
  try {
    return $.localStorage(...args)
  } catch (e) {
    debugConsole.error('localStorage exception', e)
    return null
  }
}

export default localStorage
