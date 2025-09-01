import '../../../../../test/acceptance/src/helpers/InitApp.mjs'
import MockDocstoreApi from '../../../../../test/acceptance/src/mocks/MockDocstoreApi.mjs'
import MockDocUpdaterApi from '../../../../../test/acceptance/src/mocks/MockDocUpdaterApi.mjs'
import MockNotificationsApi from '../../../../../test/acceptance/src/mocks/MockNotificationsApi.mjs'
import MockProjectHistoryApi from '../../../../../test/acceptance/src/mocks/MockProjectHistoryApi.mjs'
import MockSpellingApi from '../../../../../test/acceptance/src/mocks/MockSpellingApi.mjs'
import MockV1Api from '../../../../../test/acceptance/src/mocks/MockV1Api.mjs'
import MockV1HistoryApi from '../../../../../test/acceptance/src/mocks/MockV1HistoryApi.mjs'

const mockOpts = {
  debug: ['1', 'true', 'TRUE'].includes(process.env.DEBUG_MOCKS),
}

MockDocstoreApi.initialize(23016, mockOpts)
MockDocUpdaterApi.initialize(23003, mockOpts)
MockNotificationsApi.initialize(23042, mockOpts)
MockProjectHistoryApi.initialize(23054, mockOpts)
MockSpellingApi.initialize(23005, mockOpts)
MockV1Api.initialize(25000, mockOpts)
MockV1HistoryApi.initialize(23100, mockOpts)
