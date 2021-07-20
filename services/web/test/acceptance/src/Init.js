require('./helpers/InitApp')
const Features = require('../../../app/src/infrastructure/Features')

const MockAnalyticsApi = require('./mocks/MockAnalyticsApi')
const MockChatApi = require('./mocks/MockChatApi')
const MockClsiApi = require('./mocks/MockClsiApi')
const MockDocstoreApi = require('./mocks/MockDocstoreApi')
const MockDocUpdaterApi = require('./mocks/MockDocUpdaterApi')
const MockFilestoreApi = require('./mocks/MockFilestoreApi')
const MockNotificationsApi = require('./mocks/MockNotificationsApi')
const MockProjectHistoryApi = require('./mocks/MockProjectHistoryApi')
const MockSpellingApi = require('./mocks/MockSpellingApi')
const MockV1Api = require('./mocks/MockV1Api')
const MockV1HistoryApi = require('./mocks/MockV1HistoryApi')

const mockOpts = {
  debug: ['1', 'true', 'TRUE'].includes(process.env.DEBUG_MOCKS),
}

MockChatApi.initialize(3010, mockOpts)
MockClsiApi.initialize(3013, mockOpts)
MockDocstoreApi.initialize(3016, mockOpts)
MockDocUpdaterApi.initialize(3003, mockOpts)
MockFilestoreApi.initialize(3009, mockOpts)
MockNotificationsApi.initialize(3042, mockOpts)
MockSpellingApi.initialize(3005, mockOpts)

if (Features.hasFeature('saas')) {
  MockAnalyticsApi.initialize(3050, mockOpts)
  MockProjectHistoryApi.initialize(3054, mockOpts)
  MockV1Api.initialize(5000, mockOpts)
  MockV1HistoryApi.initialize(3100, mockOpts)
}
