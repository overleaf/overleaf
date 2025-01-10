import './helpers/InitApp.mjs'
import Features from '../../../app/src/infrastructure/Features.js'

import MockAnalyticsApi from './mocks/MockAnalyticsApi.mjs'
import MockChatApi from './mocks/MockChatApi.mjs'
import MockClsiApi from './mocks/MockClsiApi.mjs'
import MockDocstoreApi from './mocks/MockDocstoreApi.mjs'
import MockDocUpdaterApi from './mocks/MockDocUpdaterApi.mjs'
import MockFilestoreApi from './mocks/MockFilestoreApi.mjs'
import MockGitBridgeApi from './mocks/MockGitBridgeApi.mjs'
import MockNotificationsApi from './mocks/MockNotificationsApi.mjs'
import MockProjectHistoryApi from './mocks/MockProjectHistoryApi.mjs'
import MockSpellingApi from './mocks/MockSpellingApi.mjs'
import MockV1Api from './mocks/MockV1Api.mjs'
import MockV1HistoryApi from './mocks/MockV1HistoryApi.mjs'
import MockHaveIBeenPwnedApi from './mocks/MockHaveIBeenPwnedApi.mjs'
import MockThirdPartyDataStoreApi from './mocks/MockThirdPartyDataStoreApi.mjs'
import MockHistoryBackupDeletionApi from './mocks/MockHistoryBackupDeletionApi.mjs'

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
MockHistoryBackupDeletionApi.initialize(23101, mockOpts)

if (Features.hasFeature('saas')) {
  MockAnalyticsApi.initialize(23050, mockOpts)
  MockV1Api.initialize(25000, mockOpts)
  MockThirdPartyDataStoreApi.initialize(23002, mockOpts)
}

if (Features.hasFeature('git-bridge')) {
  MockGitBridgeApi.initialize(28000, mockOpts)
}
