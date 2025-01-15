/**
 * localStorage can throw browser exceptions, for example if it is full We don't
 * use localStorage for anything critical, so in that case just fail gracefully.
 */

import { debugConsole } from '@/utils/debugging'

/**
 * Catch, log and otherwise ignore errors.
 *
 * @param {function} fn localStorage function to call
 * @param {string?} key Key passed to the localStorage function (if any)
 * @param {any?} value Value passed to the localStorage function (if any)
 */
const callSafe = function (
  fn: (...args: any) => any,
  key?: string,
  value?: any
) {
  try {
    return fn(key, value)
  } catch (e) {
    debugConsole.error('localStorage exception', e)
    return null
  }
}

const getItem = function (key: string) {
  const value = localStorage.getItem(key)
  return value === null ? null : JSON.parse(value)
}

const setItem = function (key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value))
}

const clear = function () {
  localStorage.clear()
}

const removeItem = function (key: string) {
  return localStorage.removeItem(key)
}

const customLocalStorage = {
  getItem: (key: string) => callSafe(getItem, key),
  setItem: (key: string, value: any) => callSafe(setItem, key, value),
  clear: () => callSafe(clear),
  removeItem: (key: string) => callSafe(removeItem, key),
}

export default customLocalStorage
