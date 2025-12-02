import settings from '@overleaf/settings'
import ObjectPersistor from '@overleaf/object-persistor'
import AbstractPersistor from '@overleaf/object-persistor/src/AbstractPersistor.js'
import Metrics from '@overleaf/metrics'

const persistorSettings = settings.docstore
persistorSettings.Metrics = Metrics

const persistor = settings.docstore.backend
  ? ObjectPersistor(persistorSettings)
  : new AbstractPersistor()

export default persistor
