const _ = require('lodash')

/**
 * Compares a deep equality of Packs excluding _id
 */
function packsAreDuplicated(pack1, pack2) {
  return Boolean(
    pack1 &&
      pack2 &&
      pack1.v === pack2.v &&
      _.isEqual(pack1.meta, pack2.meta) &&
      _.isEqual(pack1.op, pack2.op)
  )
}

module.exports = {
  packsAreDuplicated,
}
