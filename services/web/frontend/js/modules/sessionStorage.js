import { debugConsole } from '@/utils/debugging'

angular.module('sessionStorage', []).value('sessionStorage', sessionStorage)

/*
  sessionStorage can throw browser exceptions, for example if it is full
  We don't use sessionStorage for anything critical, on in that case just
  fail gracefully.
*/
function sessionStorage(...args) {
  try {
    return $.sessionStorage(...args)
  } catch (e) {
    debugConsole.error('sessionStorage exception', e)
    return null
  }
}

export default sessionStorage
