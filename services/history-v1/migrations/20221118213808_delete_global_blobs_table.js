exports.up = async function (knex) {
  await knex.raw(`DROP TABLE IF EXISTS blobs`)
}

exports.down = function (knex) {
  // Not reversible
}
