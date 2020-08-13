/* eslint-disable
    no-console,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Sequelize = require('sequelize')
const Settings = require('settings-sharelatex')
const _ = require('lodash')
const logger = require('logger-sharelatex')

const options = _.extend({ logging: false }, Settings.mysql.clsi)

logger.log({ dbPath: Settings.mysql.clsi.storage }, 'connecting to db')

const sequelize = new Sequelize(
  Settings.mysql.clsi.database,
  Settings.mysql.clsi.username,
  Settings.mysql.clsi.password,
  options
)

if (Settings.mysql.clsi.dialect === 'sqlite') {
  logger.log('running PRAGMA journal_mode=WAL;')
  sequelize.query('PRAGMA journal_mode=WAL;')
  sequelize.query('PRAGMA synchronous=OFF;')
  sequelize.query('PRAGMA read_uncommitted = true;')
}

module.exports = {
  UrlCache: sequelize.define(
    'UrlCache',
    {
      url: Sequelize.STRING,
      project_id: Sequelize.STRING,
      lastModified: Sequelize.DATE
    },
    {
      indexes: [{ fields: ['url', 'project_id'] }, { fields: ['project_id'] }]
    }
  ),

  Project: sequelize.define(
    'Project',
    {
      project_id: { type: Sequelize.STRING, primaryKey: true },
      lastAccessed: Sequelize.DATE
    },
    {
      indexes: [{ fields: ['lastAccessed'] }]
    }
  ),

  op: Sequelize.Op,

  sync() {
    logger.log({ dbPath: Settings.mysql.clsi.storage }, 'syncing db schema')
    return sequelize
      .sync()
      .then(() => logger.log('db sync complete'))
      .catch((err) => console.log(err, 'error syncing'))
  }
}
