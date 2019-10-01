const chai = require('chai')
const expect = chai.expect
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)

const { User } = require('../../../app/src/models/User')
const { Subscription } = require('../../../app/src/models/Subscription')

describe('mongoose', function() {
  describe('User', function() {
    const email = 'wombat@potato.net'

    it('allows the creation of a user', async function() {
      await expect(User.create({ email: email })).to.be.fulfilled
      await expect(User.findOne({ email: email })).to.eventually.exist
    })

    it('does not allow the creation of multiple users with the same email', async function() {
      await expect(User.create({ email: email })).to.be.fulfilled
      await expect(User.create({ email: email })).to.be.rejected
      await expect(User.count({ email: email })).to.eventually.equal(1)
    })
  })

  describe('Subsription', function() {
    let user, otherUser

    beforeEach(async function() {
      user = await User.create({ email: 'wombat@potato.net' })
      otherUser = await User.create({ email: 'giraffe@turnip.org' })
    })

    it('allows the creation of a subscription', async function() {
      await expect(
        Subscription.create({ admin_id: user._id, manager_ids: [user._id] })
      ).to.be.fulfilled
      await expect(Subscription.findOne({ admin_id: user._id })).to.eventually
        .exist
    })

    it('does not allow the creation of a subscription without a manager', async function() {
      await expect(Subscription.create({ admin_id: user._id })).to.be.rejected
    })

    it('does not allow a user to manage more than one group', async function() {
      await expect(
        Subscription.create({ admin_id: user._id, manager_ids: [user._id] })
      ).to.be.fulfilled
      await expect(
        Subscription.create({
          admin_id: otherUser._id,
          manager_ids: [otherUser._id]
        })
      ).to.be.fulfilled
      await expect(
        Subscription.update(
          { admin_id: user._id },
          { $push: { manager_ids: otherUser._id } }
        )
      ).to.be.rejected
    })
  })
})
