const PersistorFactory = require('./src/PersistorFactory')

module.exports = function ObjectPersistor(settings) {
  return PersistorFactory(settings)
}
module.exports.Errors = require('./src/Errors')
