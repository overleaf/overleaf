import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/Features/Tutorial/TutorialHandler'

describe('TutorialHandler', function () {
  beforeEach(async function (ctx) {
    ctx.clock = sinon.useFakeTimers()

    const THIRTY_DAYS_AGO = Date.now() - 30 * 24 * 60 * 60 * 1000
    const TOMORROW = Date.now() + 24 * 60 * 60 * 1000
    const YESTERDAY = Date.now() - 24 * 60 * 60 * 1000

    ctx.user = {
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

    ctx.UserUpdater = {
      promises: {
        updateUser: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: ctx.UserUpdater,
    }))

    ctx.TutorialHandler = (await import(MODULE_PATH)).default
  })

  afterEach(function (ctx) {
    ctx.clock.restore()
  })

  describe('getInactiveTutorials', function () {
    it('returns all recorded tutorials except when they were posponed long ago', function (ctx) {
      const hiddenTutorials = ctx.TutorialHandler.getInactiveTutorials(ctx.user)
      expect(hiddenTutorials).to.have.members([
        'legacy-format',
        'completed',
        'postponed-recently',
        'postponed-until-tomorrow',
      ])

      expect(hiddenTutorials).to.have.lengthOf(4)

      const shownTutorials = Object.keys(ctx.user.completedTutorials).filter(
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
