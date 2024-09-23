const settings = require('@overleaf/settings')

const persistorSettings = settings.filestore
persistorSettings.paths = settings.path

const ObjectPersistor = require('@overleaf/object-persistor')
const persistor = ObjectPersistor(persistorSettings)

module.exports = persistor
