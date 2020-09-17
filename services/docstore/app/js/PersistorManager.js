const settings = require('settings-sharelatex')

const persistorSettings = settings.docstore
persistorSettings.Metrics = require('@overleaf/metrics')

const ObjectPersistor = require('@overleaf/object-persistor')
const persistor = ObjectPersistor(persistorSettings)

module.exports = persistor
