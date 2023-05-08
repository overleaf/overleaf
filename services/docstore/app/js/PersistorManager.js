const settings = require('@overleaf/settings')

const persistorSettings = settings.docstore
persistorSettings.Metrics = require('@overleaf/metrics')

const ObjectPersistor = require('@overleaf/object-persistor')
const AbstractPersistor = require('@overleaf/object-persistor/src/AbstractPersistor')
const persistor = settings.docstore.backend
  ? ObjectPersistor(persistorSettings)
  : new AbstractPersistor()

module.exports = persistor
