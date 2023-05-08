require('./helpers/InitApp')
const Features = require('../../../app/src/infrastructure/Features')

const MockAnalyticsApi = require('./mocks/MockAnalyticsApi')
const MockChatApi = require('./mocks/MockChatApi')
const MockClsiApi = require('./mocks/MockClsiApi')
const MockDocstoreApi = require('./mocks/MockDocstoreApi')
const MockDocUpdaterApi = require('./mocks/MockDocUpdaterApi')
const MockFilestoreApi = require('./mocks/MockFilestoreApi')
const MockGitBridgeApi = require('./mocks/MockGitBridgeApi')
const MockNotificationsApi = require('./mocks/MockNotificationsApi')
const MockProjectHistoryApi = require('./mocks/MockProjectHistoryApi')
const MockSpellingApi = require('./mocks/MockSpellingApi')
const MockV1Api = require('./mocks/MockV1Api')
const MockV1HistoryApi = require('./mocks/MockV1HistoryApi')
const MockHaveIBeenPwnedApi = require('./mocks/MockHaveIBeenPwnedApi')
const MockThirdPartyDataStoreApi = require('./mocks/MockThirdPartyDataStoreApi')

const mockOpts = {
  debug: ['1', 'true', 'TRUE'].includes(process.env.DEBUG_MOCKS),
}

MockChatApi.initialize(23010, mockOpts)
MockClsiApi.initialize(23013, mockOpts)
MockDocstoreApi.initialize(23016, mockOpts)
MockDocUpdaterApi.initialize(23003, mockOpts)
MockFilestoreApi.initialize(23009, mockOpts)
MockNotificationsApi.initialize(23042, mockOpts)
MockSpellingApi.initialize(23005, mockOpts)
MockHaveIBeenPwnedApi.initialize(1337, mockOpts)
MockProjectHistoryApi.initialize(23054, mockOpts)
MockV1HistoryApi.initialize(23100, mockOpts)

if (Features.hasFeature('saas')) {
  MockAnalyticsApi.initialize(23050, mockOpts)
  MockV1Api.initialize(25000, mockOpts)
  MockThirdPartyDataStoreApi.initialize(23002, mockOpts)
}

if (Features.hasFeature('git-bridge')) {
  MockGitBridgeApi.initialize(28000, mockOpts)
}
