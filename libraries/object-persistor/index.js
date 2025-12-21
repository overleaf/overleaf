const PersistorFactory = require('./src/PersistorFactory')

module.exports = function ObjectPersistor(settings) {
  return PersistorFactory(settings)
}
module.exports.Errors = require('./src/Errors')
module.exports.SyncPersistor = require('./src/SyncPersistor')
module.exports.WebDAVPersistor = require('./src/WebDAVPersistor')
