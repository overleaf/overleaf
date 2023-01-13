'use strict'

exports.dbSpecs = {
  chunks: Object.values(require('./chunks').chunks),
  histories: Object.values(require('./chunks').histories),
  docs: Object.values(require('./docs').docs),
}
