import sinon from 'sinon'
import {
  connectionPromise,
  cleanupTestDatabase,
} from '../../../../app/src/infrastructure/mongodb.mjs'
import ContactManager from '../../../../app/src/Features/Contacts/ContactManager.mjs'

describe('ContactManager', function () {
  beforeAll(async function () {
    await connectionPromise
  })
  beforeEach(cleanupTestDatabase)

  const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
  const contactId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
  const otherId1 = 'cccccccccccccccccccccccc'
  const otherId2 = 'dddddddddddddddddddddddd'
  const otherId3 = 'eeeeeeeeeeeeeeeeeeeeeeee'

  describe('addContact', function () {
    beforeEach(async function () {
      await ContactManager.promises.addContact(userId, contactId)
    })

    it('should record the contact under the user', async function () {
      const ids = await ContactManager.promises.getContactIds(userId, 50)
      expect(ids).to.deep.equal([contactId])
    })

    it('should record the user under the contact', async function () {
      const ids = await ContactManager.promises.getContactIds(contactId, 50)
      expect(ids).to.deep.equal([userId])
    })
  })

  describe('getContactIds', function () {
    beforeEach(async function (ctx) {
      ctx.clock = sinon.useFakeTimers(new Date('2026-01-01'))

      // otherId3: touched once at T → count 1, ts = T
      await ContactManager.promises.addContact(userId, otherId3)

      // otherId2: touched twice at T → count 2, ts = T
      await ContactManager.promises.addContact(userId, otherId2)
      await ContactManager.promises.addContact(userId, otherId2)

      // otherId1: touched once at T+1s → count 1, ts = T+1s
      ctx.clock.tick(1000)
      await ContactManager.promises.addContact(userId, otherId1)
    })

    afterEach(function (ctx) {
      ctx.clock.restore()
    })

    it('should sort by count descending then timestamp descending', async function () {
      const ids = await ContactManager.promises.getContactIds(userId, 50)
      expect(ids).to.deep.equal([otherId2, otherId1, otherId3])
    })

    it('should respect the limit', async function () {
      const ids = await ContactManager.promises.getContactIds(userId, 2)
      expect(ids).to.deep.equal([otherId2, otherId1])
    })
  })

  describe('with no contacts in the database', function () {
    it('should return an empty array', async function () {
      const ids = await ContactManager.promises.getContactIds(userId, 50)
      expect(ids).to.deep.equal([])
    })
  })
})
