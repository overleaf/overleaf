// @ts-check

import sinon from 'sinon'
import { expect } from 'chai'
import { ObjectId } from 'mongodb'
import { cleanupTestDatabase } from '../../../app/js/mongodb.js'
import * as ContactManager from '../../../app/js/ContactManager.js'
import '../../acceptance/js/MongoHelper.js'

describe('ContactManager', function () {
  beforeEach(cleanupTestDatabase)

  beforeEach(async function () {
    this.clock = sinon.useFakeTimers(new Date())
    this.user_id = new ObjectId().toString()
    this.contact_id = new ObjectId().toString()
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('touchContact', function () {
    describe('with a valid user_id', function () {
      it('should increment the contact count and timestamp', async function () {
        const now = new Date()
        await ContactManager.touchContact(this.user_id, this.contact_id)
        const contacts = await ContactManager.getContacts(this.user_id)
        expect(contacts).to.deep.equal({
          [this.contact_id]: {
            n: 1,
            ts: now,
          },
        })
      })
    })

    describe('with an invalid user id', function () {
      it('should be rejected', async function () {
        await expect(
          ContactManager.touchContact('not-valid-object-id', this.contact_id)
        ).to.be.rejectedWith(
          'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
      })
    })
  })

  describe('getContacts', function () {
    describe('with a valid user_id', function () {
      it('should find an empty contact list', async function () {
        const contacts = await ContactManager.getContacts(this.user_id)
        expect(contacts).to.be.undefined
      })
    })

    describe('with an invalid user id', function () {
      it('should be rejected', async function () {
        await expect(ContactManager.getContacts('not-valid-object-id')).to.be
          .rejected
      })
    })
  })
})
