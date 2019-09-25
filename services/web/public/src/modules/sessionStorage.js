angular.module('sessionStorage', []).value('sessionStorage', function(...args) {
  /*
    sessionStorage can throw browser exceptions, for example if it is full
    We don't use sessionStorage for anything critical, on in that case just
    fail gracefully.
  */
  try {
    return $.sessionStorage(...args)
  } catch (e) {
    console.error('sessionStorage exception', e)
    return null
  }
})
