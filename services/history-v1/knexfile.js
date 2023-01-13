const config = require('config')

const baseConfig = {
  client: 'postgresql',
  connection: config.herokuDatabaseUrl || config.databaseUrl,
  pool: {
    min: parseInt(config.databasePoolMin, 10),
    max: parseInt(config.databasePoolMax, 10),
  },
  migrations: {
    tableName: 'knex_migrations',
  },
}

module.exports = {
  development: baseConfig,
  production: baseConfig,
  test: baseConfig,
}
