/**
 * localStorage can throw browser exceptions, for example if it is full We don't
 * use localStorage for anything critical, so in that case just fail gracefully.
 */

/**
 * Catch, log and otherwise ignore errors.
 *
 * @param {function} fn localStorage function to call
 * @param {string?} key Key passed to the localStorage function (if any)
 * @param {any?} value Value passed to the localStorage function (if any)
 */
const callSafe = function (fn, key, value) {
  try {
    return fn(key, value)
  } catch (e) {
    console.error('localStorage exception', e)
    return null
  }
}

const getItem = function (key) {
  return JSON.parse(localStorage.getItem(key))
}

const setItem = function (key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

const clear = function () {
  localStorage.clear()
}

const removeItem = function (key) {
  return localStorage.removeItem(key)
}

const customLocalStorage = {
  getItem: key => callSafe(getItem, key),
  setItem: (key, value) => callSafe(setItem, key, value),
  clear: () => callSafe(clear),
  removeItem: key => callSafe(removeItem, key),
}

export default customLocalStorage
