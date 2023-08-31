require('../../../../../test/acceptance/src/helpers/InitApp')

const MockDocstoreApi = require('../../../../../test/acceptance/src/mocks/MockDocstoreApi')
const MockDocUpdaterApi = require('../../../../../test/acceptance/src/mocks/MockDocUpdaterApi')
const MockFilestoreApi = require('../../../../../test/acceptance/src/mocks/MockFilestoreApi')
const MockNotificationsApi = require('../../../../../test/acceptance/src/mocks/MockNotificationsApi')
const MockProjectHistoryApi = require('../../../../../test/acceptance/src/mocks/MockProjectHistoryApi')
const MockSpellingApi = require('../../../../../test/acceptance/src/mocks/MockSpellingApi')
const MockV1Api = require('../../../../../test/acceptance/src/mocks/MockV1Api')
const MockV1HistoryApi = require('../../../../../test/acceptance/src/mocks/MockV1HistoryApi')

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
