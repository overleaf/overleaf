const settings = require('settings-sharelatex')

const persistorSettings = settings.filestore
persistorSettings.Metrics = require('@overleaf/metrics')
persistorSettings.paths = settings.path

const ObjectPersistor = require('@overleaf/object-persistor')
const persistor = ObjectPersistor(persistorSettings)

module.exports = persistor
