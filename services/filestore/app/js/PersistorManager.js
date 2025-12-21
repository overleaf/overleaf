import settings from '@overleaf/settings'
import ObjectPersistor from '@overleaf/object-persistor'

const persistorSettings = settings.filestore
persistorSettings.paths = settings.path
import ProjectConfigProvider from './ProjectConfigProvider.js'
const { SyncPersistor } = ObjectPersistor

let persistor = ObjectPersistor(persistorSettings)

// Wrap with dynamic SyncPersistor
persistor = new SyncPersistor(persistor, ProjectConfigProvider)

export default persistor
