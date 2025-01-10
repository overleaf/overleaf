import { promisify } from 'node:util'
import { expect } from 'chai'
import Features from '../../../app/src/infrastructure/Features.js'
import MetricsHelper from './helpers/metrics.mjs'
import UserHelper from './helpers/User.mjs'
const sleep = promisify(setTimeout)

const User = UserHelper.promises

const getMetric = MetricsHelper.promises.getMetric

async function getActiveUsersMetric() {
  return getMetric(line => line.startsWith('num_active_users'))
}

describe('ActiveUsersMetricTests', function () {
  before(async function () {
    if (Features.hasFeature('saas')) {
      this.skip()
    }
  })

  it('updates "num_active_users" metric after a new user opens a project', async function () {
    expect(await getActiveUsersMetric()).to.equal(0)

    this.user = new User()
    await this.user.login()
    const projectId = await this.user.createProject('test project')
    await this.user.openProject(projectId)

    // settings.activeUserMetricInterval is configured to 100ms
    await sleep(110)

    expect(await getActiveUsersMetric()).to.equal(1)
  })
})
