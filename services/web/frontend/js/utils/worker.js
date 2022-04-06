export const createWorker = callback => {
  const webpackPublicPath = __webpack_public_path__
  __webpack_public_path__ = '/'
  callback()
  __webpack_public_path__ = webpackPublicPath
}
