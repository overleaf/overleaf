const { promisify } = require('util')
const { expect } = require('chai')
const Features = require('../../../app/src/infrastructure/Features')
const {
  promises: { getMetric },
} = require('./helpers/metrics')
const User = require('./helpers/User').promises
const sleep = promisify(setTimeout)

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
