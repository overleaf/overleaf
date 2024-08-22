require('../../../../../test/acceptance/src/helpers/InitApp')
const MockProjectHistoryApi = require('../../../../../test/acceptance/src/mocks/MockProjectHistoryApi')
const MockDocstoreApi = require('../../../../../test/acceptance/src/mocks/MockDocstoreApi')
const MockDocUpdaterApi = require('../../../../../test/acceptance/src/mocks/MockDocUpdaterApi')
const MockV1Api = require('../../../../admin-panel/test/acceptance/src/mocks/MockV1Api')

const mockOpts = {
  debug: ['1', 'true', 'TRUE'].includes(process.env.DEBUG_MOCKS),
}

MockDocstoreApi.initialize(23016, mockOpts)
MockDocUpdaterApi.initialize(23003, mockOpts)
MockProjectHistoryApi.initialize(23054, mockOpts)
MockV1Api.initialize(25000, mockOpts)
