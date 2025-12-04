import settings from '@overleaf/settings'
import ObjectPersistor from '@overleaf/object-persistor'

const persistorSettings = settings.filestore
persistorSettings.paths = settings.path
const persistor = ObjectPersistor(persistorSettings)

export default persistor
