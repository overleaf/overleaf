import '../../../../../test/acceptance/src/helpers/InitApp.mjs'
import MockDocstoreApi from '../../../../../test/acceptance/src/mocks/MockDocstoreApi.js'
import MockDocUpdaterApi from '../../../../../test/acceptance/src/mocks/MockDocUpdaterApi.js'
import MockFilestoreApi from '../../../../../test/acceptance/src/mocks/MockFilestoreApi.js'
import MockNotificationsApi from '../../../../../test/acceptance/src/mocks/MockNotificationsApi.mjs'
import MockProjectHistoryApi from '../../../../../test/acceptance/src/mocks/MockProjectHistoryApi.js'
import MockSpellingApi from '../../../../../test/acceptance/src/mocks/MockSpellingApi.mjs'
import MockV1Api from '../../../../../test/acceptance/src/mocks/MockV1Api.js'
import MockV1HistoryApi from '../../../../../test/acceptance/src/mocks/MockV1HistoryApi.js'

const mockOpts = {
  debug: ['1', 'true', 'TRUE'].includes(process.env.DEBUG_MOCKS),
}

MockDocstoreApi.initialize(23016, mockOpts)
MockDocUpdaterApi.initialize(23003, mockOpts)
MockFilestoreApi.initialize(23009, mockOpts)
MockNotificationsApi.initialize(23042, mockOpts)
MockProjectHistoryApi.initialize(23054, mockOpts)
MockSpellingApi.initialize(23005, mockOpts)
MockV1Api.initialize(25000, mockOpts)
MockV1HistoryApi.initialize(23100, mockOpts)
