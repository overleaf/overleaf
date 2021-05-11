const { expect } = require('chai')
const Settings = require('settings-sharelatex')
const UserHelper = require('./helpers/UserHelper')
const MockV1ApiClass = require('./mocks/MockV1Api')

const InstitutionsReconfirmationHandler = require('../../../app/src/Features/Institutions/InstitutionsReconfirmationHandler')

let MockV1Api
let userHelper = new UserHelper()

before(function () {
  MockV1Api = MockV1ApiClass.instance()
})

describe('InstitutionsReconfirmationHandler', function () {
  const institutionUsers = []
  let result

  beforeEach(async function () {
    // create institution
    const domain = 'institution-1.com'
    const maxConfirmationMonths = 6
    MockV1Api.createInstitution({
      commonsAccount: true,
      confirmed: true,
      hostname: domain,
      maxConfirmationMonths,
    })

    // create users affiliated with institution
    async function _createInstitutionUserPastReconfirmation() {
      userHelper = await UserHelper.createUser()
      const userId = userHelper.user._id

      // add the affiliation
      userHelper = await UserHelper.loginUser(
        userHelper.getDefaultEmailPassword()
      )
      const institutionEmail = `${userId}@${domain}`
      await userHelper.addEmailAndConfirm(userId, institutionEmail)
      institutionUsers.push(userId)

      // backdate confirmation
      await userHelper.changeConfirmedToPastReconfirmation(
        userId,
        institutionEmail,
        maxConfirmationMonths
      )

      // verify user has features before script run
      const result = await UserHelper.getUser(
        { _id: userHelper.user._id },
        { features: 1 }
      )
      expect(result.user.features).to.deep.equal(Settings.features.professional)

      return userId
    }
    await _createInstitutionUserPastReconfirmation()
    await _createInstitutionUserPastReconfirmation()
    await _createInstitutionUserPastReconfirmation()

    result = await InstitutionsReconfirmationHandler.processLapsed()
  })

  it('should refresh features', async function () {
    expect(result.failedToRefresh.length).to.equal(0)
    expect(result.refreshedUsers.length).to.equal(3)
  })
})
