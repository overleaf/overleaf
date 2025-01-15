/**
 * sessionStorage can throw browser exceptions, for example if it is full.
 * We don't use sessionStorage for anything critical, so in that case just fail gracefully.
 */

import { debugConsole } from '@/utils/debugging'

/**
 * Catch, log and otherwise ignore errors.
 *
 * @param {function} fn sessionStorage function to call
 * @param {string?} key Key passed to the sessionStorage function (if any)
 * @param {any?} value Value passed to the sessionStorage function (if any)
 */
const callSafe = function (
  fn: (...args: any) => any,
  key?: string,
  value?: any
) {
  try {
    return fn(key, value)
  } catch (e) {
    debugConsole.error('sessionStorage exception', e)
    return null
  }
}

const getItem = function (key: string) {
  const value = sessionStorage.getItem(key)
  return value === null ? null : JSON.parse(value)
}

const setItem = function (key: string, value: any) {
  sessionStorage.setItem(key, JSON.stringify(value))
}

const clear = function () {
  sessionStorage.clear()
}

const removeItem = function (key: string) {
  return sessionStorage.removeItem(key)
}

const customSessionStorage = {
  getItem: (key: string) => callSafe(getItem, key),
  setItem: (key: string, value: any) => callSafe(setItem, key, value),
  clear: () => callSafe(clear),
  removeItem: (key: string) => callSafe(removeItem, key),
}

export default customSessionStorage
