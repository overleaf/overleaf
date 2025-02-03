'use strict'

const config = require('config')
const knexfile = require('../../knexfile')

const env = process.env.NODE_ENV || 'development'

if (config.databaseUrlReadOnly) {
  module.exports = require('knex')({
    ...knexfile[env],
    pool: {
      ...knexfile[env].pool,
      min: 0,
    },
    connection: config.databaseUrlReadOnly,
  })
} else {
  module.exports = require('./knex')
}
