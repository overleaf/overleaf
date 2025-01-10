import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import { Project } from '../../../app/src/models/Project.js'
import mongodb from 'mongodb-legacy'
import cheerio from 'cheerio'
import { Subscription } from '../../../app/src/models/Subscription.js'
import Features from '../../../app/src/infrastructure/Features.js'

const ObjectId = mongodb.ObjectId

const User = UserHelper.promises

describe('Project CRUD', function () {
  beforeEach(async function () {
    this.user = new User()
    await this.user.login()
    this.projectId = await this.user.createProject('example-project')
  })

  describe('project page', function () {
    const loadProject = async function (user, projectId) {
      const { response, body } = await user.doRequest(
        'GET',
        `/project/${projectId}`
      )
      expect(response.statusCode).to.equal(200)
      return body
    }

    it('should cast refProviders to booleans', async function () {
      await this.user.mongoUpdate({
        $set: {
          refProviders: {
            mendeley: { encrypted: 'aaa' },
            zotero: { encrypted: 'bbb' },
          },
        },
      })
      const body = await loadProject(this.user, this.projectId)
      const dom = cheerio.load(body)
      const metaOlUser = dom('meta[name="ol-user"]')[0]
      const userData = JSON.parse(metaOlUser.attribs.content)
      expect(userData.refProviders.mendeley).to.equal(true)
      expect(userData.refProviders.zotero).to.equal(true)
    })

    it('should show UpgradePrompt for user without a subscription', async function () {
      const body = await loadProject(this.user, this.projectId)
      expect(body).to.include(
        Features.hasFeature('saas')
          ? // `content` means true in this context
            '<meta name="ol-showUpgradePrompt" data-type="boolean" content>'
          : '<meta name="ol-showUpgradePrompt" data-type="boolean">'
      )
    })

    it('should not show UpgradePrompt for user with a subscription', async function () {
      await Subscription.create({
        admin_id: this.user._id,
        manager_ids: [this.user._id],
      })
      const body = await loadProject(this.user, this.projectId)
      // having no `content` means false in this context
      expect(body).to.include(
        '<meta name="ol-showUpgradePrompt" data-type="boolean">'
      )
    })
  })

  describe("when project doesn't exist", function () {
    it('should return 404', async function () {
      const { response } = await this.user.doRequest(
        'GET',
        '/project/aaaaaaaaaaaaaaaaaaaaaaaa'
      )
      expect(response.statusCode).to.equal(404)
    })
  })

  describe('when project has malformed id', function () {
    it('should return 404', async function () {
      const { response } = await this.user.doRequest('GET', '/project/blah')
      expect(response.statusCode).to.equal(404)
    })
  })

  describe('when trashing a project', function () {
    it('should mark the project as trashed for the user', async function () {
      const { response } = await this.user.doRequest(
        'POST',
        `/project/${this.projectId}/trash`
      )
      expect(response.statusCode).to.equal(200)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [this.user._id])
    })

    it('does nothing if the user has already trashed the project', async function () {
      // Mark as trashed the first time
      await this.user.doRequest('POST', `/project/${this.projectId}/trash`)

      // And then a second time
      await this.user.doRequest('POST', `/project/${this.projectId}/trash`)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [this.user._id])
    })

    describe('with an array archived state', function () {
      it('should mark the project as not archived for the user', async function () {
        await Project.updateOne(
          { _id: this.projectId },
          { $set: { archived: [new ObjectId(this.user._id)] } }
        ).exec()

        const { response } = await this.user.doRequest(
          'POST',
          `/project/${this.projectId}/trash`
        )

        expect(response.statusCode).to.equal(200)

        const trashedProject = await Project.findById(this.projectId).exec()
        expectObjectIdArrayEqual(trashedProject.archived, [])
      })
    })

    describe('with a legacy boolean state', function () {
      it('should mark the project as not archived for the user', async function () {
        await Project.updateOne(
          { _id: this.projectId },
          { $set: { archived: true } }
        ).exec()

        const { response } = await this.user.doRequest(
          'POST',
          `/project/${this.projectId}/trash`
        )

        expect(response.statusCode).to.equal(200)

        const trashedProject = await Project.findById(this.projectId).exec()
        expectObjectIdArrayEqual(trashedProject.archived, [])
      })
    })
  })

  describe('when untrashing a project', function () {
    it('should mark the project as untrashed for the user', async function () {
      await Project.updateOne(
        { _id: this.projectId },
        { trashed: [new ObjectId(this.user._id)] }
      ).exec()
      const { response } = await this.user.doRequest(
        'DELETE',
        `/project/${this.projectId}/trash`
      )
      expect(response.statusCode).to.equal(200)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [])
    })

    it('does nothing if the user has already untrashed the project', async function () {
      await Project.updateOne(
        { _id: this.projectId },
        { trashed: [new ObjectId(this.user._id)] }
      ).exec()
      // Mark as untrashed the first time
      await this.user.doRequest('DELETE', `/project/${this.projectId}/trash`)

      // And then a second time
      await this.user.doRequest('DELETE', `/project/${this.projectId}/trash`)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [])
    })

    it('sets trashed to an empty array if not set', async function () {
      await this.user.doRequest('DELETE', `/project/${this.projectId}/trash`)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [])
    })
  })
})

function expectObjectIdArrayEqual(objectIdArray, stringArray) {
  const stringifiedArray = objectIdArray.map(id => id.toString())
  expect(stringifiedArray).to.deep.equal(stringArray)
}
