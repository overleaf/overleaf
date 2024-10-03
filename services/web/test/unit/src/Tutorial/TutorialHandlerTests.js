const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH = '../../../../app/src/Features/Tutorial/TutorialHandler'

describe('TutorialHandler', function () {
  beforeEach(function () {
    this.clock = sinon.useFakeTimers()

    const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000
    const TOMORROW = Date.now() + 24 * 60 * 60 * 1000
    const YESTERDAY = Date.now() - 24 * 60 * 60 * 1000

    this.user = {
      _id: new ObjectId(),
      completedTutorials: {
        'legacy-format': new Date(Date.now() - 1000),
        completed: {
          state: 'completed',
          updatedAt: new Date(Date.now() - 1000),
        },
        'postponed-recently': {
          state: 'postponed',
          updatedAt: new Date(Date.now() - 1000),
        },
        'postponed-long-ago': {
          state: 'postponed',
          updatedAt: new Date(THIRTY_DAYS_AGO),
        },
        'postponed-until-tomorrow': {
          state: 'postponed',
          updatedAt: new Date(THIRTY_DAYS_AGO),
          postponedUntil: new Date(TOMORROW),
        },
        'postponed-until-yesterday': {
          state: 'postponed',
          updatedAt: new Date(THIRTY_DAYS_AGO),
          postponedUntil: new Date(YESTERDAY),
        },
      },
    }

    this.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }

    this.TutorialHandler = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../User/UserUpdater': this.UserUpdater,
      },
    })
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('getInactiveTutorials', function () {
    it('returns all recorded tutorials except when they were posponed long ago', function () {
      const hiddenTutorials = this.TutorialHandler.getInactiveTutorials(
        this.user
      )
      expect(hiddenTutorials).to.have.members([
        'legacy-format',
        'completed',
        'postponed-recently',
        'postponed-until-tomorrow',
      ])

      expect(hiddenTutorials).to.have.lengthOf(4)

      const shownTutorials = Object.keys(this.user.completedTutorials).filter(
        key => !hiddenTutorials.includes(key)
      )

      expect(shownTutorials).to.have.members([
        'postponed-long-ago',
        'postponed-until-yesterday',
      ])
      expect(shownTutorials).to.have.lengthOf(2)
    })
  })
})
