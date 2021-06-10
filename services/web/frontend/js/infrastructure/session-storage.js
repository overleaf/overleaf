/**
 * sessionStorage can throw browser exceptions, for example if it is full.
 * We don't use sessionStorage for anything critical, so in that case just fail gracefully.
 */

/**
 * Catch, log and otherwise ignore errors.
 *
 * @param {function} fn sessionStorage function to call
 * @param {string?} key Key passed to the sessionStorage function (if any)
 * @param {any?} value Value passed to the sessionStorage function (if any)
 */
const callSafe = function (fn, key, value) {
  try {
    return fn(key, value)
  } catch (e) {
    console.error('sessionStorage exception', e)
    return null
  }
}

const getItem = function (key) {
  return JSON.parse(sessionStorage.getItem(key))
}

const setItem = function (key, value) {
  sessionStorage.setItem(key, JSON.stringify(value))
}

const clear = function () {
  sessionStorage.clear()
}

const removeItem = function (key) {
  return sessionStorage.removeItem(key)
}

const customSessionStorage = {
  getItem: key => callSafe(getItem, key),
  setItem: (key, value) => callSafe(setItem, key, value),
  clear: () => callSafe(clear),
  removeItem: key => callSafe(removeItem, key),
}

export default customSessionStorage
