import '../../../../../test/acceptance/src/helpers/InitApp.mjs'
import MockProjectHistoryApi from '../../../../../test/acceptance/src/mocks/MockProjectHistoryApi.mjs'
import MockDocstoreApi from '../../../../../test/acceptance/src/mocks/MockDocstoreApi.mjs'
import MockDocUpdaterApi from '../../../../../test/acceptance/src/mocks/MockDocUpdaterApi.mjs'
import MockV1Api from '../../../../admin-panel/test/acceptance/src/mocks/MockV1Api.mjs'

const mockOpts = {
  debug: ['1', 'true', 'TRUE'].includes(process.env.DEBUG_MOCKS),
}

MockDocstoreApi.initialize(23016, mockOpts)
MockDocUpdaterApi.initialize(23003, mockOpts)
MockProjectHistoryApi.initialize(23054, mockOpts)
MockV1Api.initialize(25000, mockOpts)
