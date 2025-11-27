import { db, ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'
import { expect } from 'chai'
import { callbackifyClass } from '@overleaf/promise-utils'
import SubscriptionUpdater from '../../../../app/src/Features/Subscription/SubscriptionUpdater.mjs'
import PermissionsManager from '../../../../app/src/Features/Authorization/PermissionsManager.mjs'
import SSOConfigManager from '../../../../modules/group-settings/app/src/sso/SSOConfigManager.mjs'
import { Subscription as SubscriptionModel } from '../../../../app/src/models/Subscription.mjs'
import { DeletedSubscription as DeletedSubscriptionModel } from '../../../../app/src/models/DeletedSubscription.mjs'
import Modules from '../../../../app/src/infrastructure/Modules.mjs'

class PromisifiedSubscription {
  constructor(options = {}) {
    this.admin_id = options.adminId || new ObjectId()
    this.overleaf = options.overleaf || {}
    this.groupPlan = options.groupPlan
    this.manager_ids = options.managerIds || [this.admin_id]
    this.member_ids = options.memberIds || []
    this.membersLimit = options.membersLimit || 0
    this.invited_emails = options.invitedEmails || []
    this.teamName = options.teamName
    this.teamInvites = options.teamInvites || []
    this.planCode = options.planCode
    this.recurlySubscription_id = options.recurlySubscription_id
    this.features = options.features
    this.ssoConfig = options.ssoConfig
    this.groupPolicy = options.groupPolicy
    this.addOns = options.addOns
    this.paymentProvider = options.paymentProvider
    this.managedUsersEnabled = options.managedUsersEnabled
  }

  async ensureExists() {
    if (this._id) {
      return null
    }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }
    const subscription = await SubscriptionModel.findOneAndUpdate(
      { admin_id: this.admin_id },
      this,
      options
    ).exec()
    this._id = subscription._id
  }

  async get() {
    return await db.subscriptions.findOne({ _id: new ObjectId(this._id) })
  }

  async getSSOConfig() {
    const subscription = await this.get()

    if (!subscription.ssoConfig) {
      return
    }

    return await db.ssoConfigs.findOne({
      _id: new ObjectId(subscription.ssoConfig),
    })
  }

  async getWithGroupPolicy() {
    // eslint-disable-next-line no-restricted-syntax
    return await SubscriptionModel.findById(this._id)
      .populate('groupPolicy')
      .exec()
  }

  async setManagerIds(managerIds) {
    return await SubscriptionModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { manager_ids: managerIds }
    )
  }

  async setSSOConfig(ssoConfig) {
    const subscription = await this.get()

    return await SSOConfigManager.promises.updateSubscriptionSSOConfig(
      subscription,
      ssoConfig
    )
  }

  async refreshUsersFeatures() {
    return await SubscriptionUpdater.promises.refreshUsersFeatures(this)
  }

  async enableManagedUsers() {
    await Modules.promises.hooks.fire('enableManagedUsers', this._id, {
      initiatorId: this.admin_id,
      ipAddress: '123.456.789.0',
    })
  }

  async disableManagedUsers() {
    await Modules.promises.hooks.fire('disableManagedUsers', this._id)
  }

  async enableFeatureSSO() {
    await SubscriptionModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { 'features.groupSSO': true }
    ).exec()
  }

  async setValidatedSSO() {
    const doc = await db.subscriptions.findOne({ _id: new ObjectId(this._id) })

    const ssoConfigId = doc.ssoConfig

    return await db.ssoConfigs.findOneAndUpdate(
      { _id: ssoConfigId },
      { $set: { validated: true } }
    )
  }

  async setValidatedAndEnabledSSO() {
    const doc = await db.subscriptions.findOne({ _id: new ObjectId(this._id) })

    const ssoConfigId = doc.ssoConfig

    return await db.ssoConfigs.findOneAndUpdate(
      { _id: ssoConfigId },
      { $set: { enabled: true, validated: true } }
    )
  }

  async getEnrollmentForUser(user) {
    const [enrollment] = await Modules.promises.hooks.fire(
      'getManagedUsersEnrollmentForUser',
      user
    )
    return enrollment
  }

  getCapabilities(groupPolicy) {
    return PermissionsManager.getUserCapabilities(groupPolicy)
  }

  async getUserValidationStatus(params) {
    return await PermissionsManager.promises.getUserValidationStatus(params)
  }

  async enrollManagedUser(user) {
    const subscription = await SubscriptionModel.findById(this._id).exec()
    return await Modules.promises.hooks.fire(
      'enrollInManagedSubscription',
      user._id,
      subscription,
      {
        initiatorId: user._id,
        ipAddress: '0:0:0:0',
      }
    )
  }

  async expectDeleted(deleterData) {
    const deletedSubscriptions = await DeletedSubscriptionModel.find({
      'subscription._id': this._id,
    }).exec()

    expect(deletedSubscriptions.length).to.equal(1)

    const deletedSubscription = deletedSubscriptions[0]
    expect(deletedSubscription.subscription.teamInvites).to.be.empty
    expect(deletedSubscription.subscription.invited_emails).to.be.empty
    expect(deletedSubscription.deleterData.deleterIpAddress).to.equal(
      deleterData.ip
    )
    if (deleterData.id) {
      expect(deletedSubscription.deleterData.deleterId.toString()).to.equal(
        deleterData.id.toString()
      )
    } else {
      expect(deletedSubscription.deleterData.deleterId).to.be.undefined
    }

    const subscription = await SubscriptionModel.findById(this._id).exec()
    expect(subscription).to.be.null
  }

  async addMember(userId) {
    return await SubscriptionModel.findOneAndUpdate(
      { _id: new ObjectId(this._id) },
      { $push: { member_ids: userId } }
    ).exec()
  }

  async inviteUser(adminUser, email) {
    await adminUser.login()
    return await adminUser.doRequest('POST', {
      url: `/manage/groups/${this._id}/invites`,
      json: {
        email,
      },
    })
  }
}

const Subscription = callbackifyClass(PromisifiedSubscription, {
  without: ['getCapabilities'],
})
Subscription.promises = class extends PromisifiedSubscription {}

export default Subscription
