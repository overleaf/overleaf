import './helpers/InitApp.mjs'
import Features from '../../../app/src/infrastructure/Features.js'

import MockAnalyticsApi from './mocks/MockAnalyticsApi.js'
import MockChatApi from './mocks/MockChatApi.js'
import MockClsiApi from './mocks/MockClsiApi.js'
import MockDocstoreApi from './mocks/MockDocstoreApi.js'
import MockDocUpdaterApi from './mocks/MockDocUpdaterApi.js'
import MockFilestoreApi from './mocks/MockFilestoreApi.js'
import MockGitBridgeApi from './mocks/MockGitBridgeApi.js'
import MockNotificationsApi from './mocks/MockNotificationsApi.js'
import MockProjectHistoryApi from './mocks/MockProjectHistoryApi.js'
import MockSpellingApi from './mocks/MockSpellingApi.js'
import MockV1Api from './mocks/MockV1Api.js'
import MockV1HistoryApi from './mocks/MockV1HistoryApi.js'
import MockHaveIBeenPwnedApi from './mocks/MockHaveIBeenPwnedApi.js'
import MockThirdPartyDataStoreApi from './mocks/MockThirdPartyDataStoreApi.js'

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
