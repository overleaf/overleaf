// @ts-check
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * @typedef {Object} RequestContext
 * @property {Object.<string, array>} [userFullEmails] - Dictionary mapping userId to an array of full emails
 */

/** @type {AsyncLocalStorage<RequestContext>} */
const asyncLocalStorage = new AsyncLocalStorage()

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function middleware(req, res, next) {
  asyncLocalStorage.run({}, next)
}

/**
 * Remove a key from the AsyncLocalStorage cache
 *
 * @param {string} key
 */
function removeItem(key) {
  const store = asyncLocalStorage.getStore()

  if (store?.[key]) {
    delete store[key]
  }
}

export default {
  middleware,
  storage: asyncLocalStorage,
  removeItem,
}
