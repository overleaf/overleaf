import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'
import { ObjectId } from 'mongodb'

describe('ContactManager', function () {
  beforeEach(async function () {
    this.clock = sinon.useFakeTimers(new Date())

    this.db = { contacts: {} }

    this.ContactManager = await esmock('../../../app/js/ContactManager', {
      '../../../app/js/mongodb': {
        db: this.db,
        ObjectId,
      },
    })

    this.user_id = new ObjectId().toString()
    this.contact_id = new ObjectId().toString()
  })

  afterEach(function () {
    this.clock.restore()
  })

  describe('touchContact', function () {
    beforeEach(function () {
      this.db.contacts.updateOne = sinon.stub().resolves()
    })

    describe('with a valid user_id', function () {
      it('should increment the contact count and timestamp', async function () {
        await expect(
          this.ContactManager.touchContact(this.user_id, 'mock_contact')
        ).not.to.be.rejected

        expect(this.db.contacts.updateOne).to.be.calledWith(
          {
            user_id: sinon.match(o => o.toString() === this.user_id),
          },
          {
            $inc: {
              'contacts.mock_contact.n': 1,
            },
            $set: {
              'contacts.mock_contact.ts': new Date(),
            },
          },
          {
            upsert: true,
          }
        )
      })
    })

    describe('with an invalid user id', function () {
      it('should be rejected', async function () {
        await expect(
          this.ContactManager.touchContact(
            'not-valid-object-id',
            this.contact_id
          )
        ).to.be.rejectedWith(
          'input must be a 24 character hex string, 12 byte Uint8Array, or an integer'
        )
      })
    })
  })

  describe('getContacts', function () {
    beforeEach(function () {
      this.user = {
        contacts: ['mock', 'contacts'],
      }
      this.db.contacts.findOne = sinon.stub().resolves(this.user)
    })

    describe('with a valid user_id', function () {
      it("should find the user's contacts", async function () {
        await expect(
          this.ContactManager.getContacts(this.user_id)
        ).to.eventually.deep.equal(this.user.contacts)

        expect(this.db.contacts.findOne).to.be.calledWith({
          user_id: sinon.match(o => o.toString() === this.user_id),
        })
      })
    })

    describe('with an invalid user id', function () {
      it('should be rejected', async function () {
        await expect(this.ContactManager.getContacts('not-valid-object-id')).to
          .be.rejected
      })
    })
  })
})
