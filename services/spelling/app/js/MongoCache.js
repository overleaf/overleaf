// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
const LRU = require('lru-cache')
const cacheOpts = {
  max: 15000,
  maxAge: 1000 * 60 * 60 * 10
}

const cache = LRU(cacheOpts)

module.exports = cache
