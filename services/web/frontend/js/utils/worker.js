export const createWorker = callback => {
  if (process.env.CYPRESS) {
    return callback()
  }
  const webpackPublicPath = __webpack_public_path__
  __webpack_public_path__ = '/'
  callback()
  __webpack_public_path__ = webpackPublicPath
}
