const { ObjectId } = require('mongodb')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')

const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender.js'
)

const projectId = 'project_id_here'
const userId = ObjectId()
const readOnlyRef = ObjectId()
const collaberatorRef = ObjectId()
const projectName = 'project_name_here'

const thirdPartyDataStoreApiUrl = 'http://third-party-json-store.herokuapp.com'
const siteUrl = 'http://www.localhost:3000'
const filestoreUrl = 'filestore.sharelatex.com'
const projectArchiverUrl = 'project-archiver.overleaf.com'

describe('TpdsUpdateSender', function () {
  beforeEach(function () {
    this.fakeUser = {
      _id: '12390i',
    }
    this.memberIds = [userId, collaberatorRef, readOnlyRef]
    this.CollaboratorsGetter = {
      promises: {
        getInvitedMemberIds: sinon.stub().resolves(this.memberIds),
      },
    }
    this.docstoreUrl = 'docstore.sharelatex.env'
    this.response = {
      ok: true,
      json: sinon.stub(),
    }
    this.fetch = sinon.stub().resolves(this.response)
    this.settings = {
      siteUrl,
      apis: {
        thirdPartyDataStore: { url: thirdPartyDataStoreApiUrl },
        filestore: {
          url: filestoreUrl,
        },
        docstore: {
          pubUrl: this.docstoreUrl,
        },
      },
    }
    const getUsers = sinon.stub()
    getUsers
      .withArgs({
        _id: {
          $in: this.memberIds,
        },
        'dropbox.access_token.uid': { $ne: null },
      })
      .resolves(
        this.memberIds.map(userId => {
          return { _id: userId }
        })
      )
    this.UserGetter = {
      promises: { getUsers },
    }
    this.TpdsUpdateSender = SandboxedModule.require(modulePath, {
      requires: {
        mongodb: { ObjectId },
        '@overleaf/settings': this.settings,
        'node-fetch': this.fetch,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../User/UserGetter.js': this.UserGetter,
        '@overleaf/metrics': {
          inc() {},
        },
      },
    })
  })

  describe('enqueue', function () {
    it('should not call request if there is no tpdsworker url', async function () {
      await this.TpdsUpdateSender.promises.enqueue(null, null, null)
      this.fetch.should.not.have.been.called
    })

    it('should post the message to the tpdsworker', async function () {
      this.settings.apis.tpdsworker = { url: 'http://tpdsworker' }
      const group0 = 'myproject'
      const method0 = 'somemethod0'
      const job0 = 'do something'
      await this.TpdsUpdateSender.promises.enqueue(group0, method0, job0)
      this.fetch.should.have.been.calledWith(
        new URL('http://tpdsworker/enqueue/web_to_tpds_http_requests'),
        sinon.match({ method: 'POST' })
      )
      const opts = this.fetch.firstCall.args[1]
      const body = JSON.parse(opts.body)
      body.group.should.equal(group0)
      body.job.should.equal(job0)
      body.method.should.equal(method0)
    })
  })

  describe('sending updates', function () {
    beforeEach(function () {
      this.settings.apis.tpdsworker = { url: 'http://tpdsworker' }
    })

    it('queues a post the file with user and file id', async function () {
      const fileId = '4545345'
      const path = '/some/path/here.jpg'

      await this.TpdsUpdateSender.promises.addFile({
        projectId,
        fileId,
        path,
        projectName,
      })

      const {
        group: group0,
        job: job0,
        method: method0,
      } = JSON.parse(this.fetch.firstCall.args[1].body)
      group0.should.equal(userId.toString())
      method0.should.equal('pipeStreamFrom')
      job0.method.should.equal('post')
      job0.streamOrigin.should.equal(
        `${filestoreUrl}/project/${projectId}/file/${fileId}`
      )
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job0.uri.should.equal(expectedUrl)
      job0.headers.sl_all_user_ids.should.equal(JSON.stringify([userId]))
      job0.headers.sl_project_owner_user_id.should.equal(userId.toString())

      const { group: group1, job: job1 } = JSON.parse(
        this.fetch.secondCall.args[1].body
      )
      group1.should.equal(collaberatorRef.toString())
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )
      job1.headers.sl_project_owner_user_id.should.equal(userId.toString())

      const { group: group2, job: job2 } = JSON.parse(
        this.fetch.thirdCall.args[1].body
      )
      group2.should.equal(readOnlyRef.toString())
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))
      job2.headers.sl_project_owner_user_id.should.equal(userId.toString())
    })

    it('post doc with stream origin of docstore', async function () {
      const docId = '4545345'
      const path = '/some/path/here.tex'
      const lines = ['line1', 'line2', 'line3']

      await this.TpdsUpdateSender.promises.addDoc({
        projectId,
        docId,
        path,
        docLines: lines,
        projectName,
      })

      const {
        group: group0,
        job: job0,
        method: method0,
      } = JSON.parse(this.fetch.firstCall.args[1].body)

      group0.should.equal(userId.toString())
      method0.should.equal('pipeStreamFrom')
      job0.method.should.equal('post')
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId.toString()}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job0.uri.should.equal(expectedUrl)
      job0.streamOrigin.should.equal(
        `${this.docstoreUrl}/project/${projectId}/doc/${docId}/raw`
      )
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))

      const { group: group1, job: job1 } = JSON.parse(
        this.fetch.secondCall.args[1].body
      )
      group1.should.equal(collaberatorRef.toString())
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = JSON.parse(
        this.fetch.thirdCall.args[1].body
      )
      group2.should.equal(readOnlyRef.toString())
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))
    })

    it('deleting entity', async function () {
      const path = '/path/here/t.tex'
      const subtreeEntityIds = ['id1', 'id2']

      await this.TpdsUpdateSender.promises.deleteEntity({
        projectId,
        path,
        projectName,
        subtreeEntityIds,
      })

      const {
        group: group0,
        job: job0,
        method: method0,
      } = JSON.parse(this.fetch.firstCall.args[1].body)

      group0.should.equal(userId.toString())
      method0.should.equal('standardHttpRequest')
      job0.method.should.equal('delete')
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))
      job0.uri.should.equal(expectedUrl)
      expect(job0.json).to.deep.equal({ subtreeEntityIds })

      const { group: group1, job: job1 } = JSON.parse(
        this.fetch.secondCall.args[1].body
      )
      group1.should.equal(collaberatorRef.toString())
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = JSON.parse(
        this.fetch.thirdCall.args[1].body
      )
      group2.should.equal(readOnlyRef.toString())
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))
    })

    it('moving entity', async function () {
      const startPath = 'staring/here/file.tex'
      const endPath = 'ending/here/file.tex'

      await this.TpdsUpdateSender.promises.moveEntity({
        projectId,
        startPath,
        endPath,
        projectName,
      })

      const {
        group: group0,
        job: job0,
        method: method0,
      } = JSON.parse(this.fetch.firstCall.args[1].body)

      group0.should.equal(userId.toString())
      method0.should.equal('standardHttpRequest')
      job0.method.should.equal('put')
      job0.uri.should.equal(
        `${thirdPartyDataStoreApiUrl}/user/${userId}/entity`
      )
      job0.json.startPath.should.equal(`/${projectName}/${startPath}`)
      job0.json.endPath.should.equal(`/${projectName}/${endPath}`)
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))

      const { group: group1, job: job1 } = JSON.parse(
        this.fetch.secondCall.args[1].body
      )
      group1.should.equal(collaberatorRef.toString())
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = JSON.parse(
        this.fetch.thirdCall.args[1].body
      )
      group2.should.equal(readOnlyRef.toString())
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))
    })

    it('should be able to rename a project using the move entity func', async function () {
      const oldProjectName = '/oldProjectName/'
      const newProjectName = '/newProjectName/'

      await this.TpdsUpdateSender.promises.moveEntity({
        projectId,
        projectName: oldProjectName,
        newProjectName,
      })

      const {
        group: group0,
        job: job0,
        method: method0,
      } = JSON.parse(this.fetch.firstCall.args[1].body)

      group0.should.equal(userId.toString())
      method0.should.equal('standardHttpRequest')
      job0.method.should.equal('put')
      job0.uri.should.equal(
        `${thirdPartyDataStoreApiUrl}/user/${userId}/entity`
      )
      job0.json.startPath.should.equal(oldProjectName)
      job0.json.endPath.should.equal(newProjectName)
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))

      const { group: group1, job: job1 } = JSON.parse(
        this.fetch.secondCall.args[1].body
      )
      group1.should.equal(collaberatorRef.toString())
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = JSON.parse(
        this.fetch.thirdCall.args[1].body
      )
      group2.should.equal(readOnlyRef.toString())
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))
    })

    it('pollDropboxForUser', async function () {
      await this.TpdsUpdateSender.promises.pollDropboxForUser(userId.toString())

      const {
        group: group0,
        job: job0,
        method: method0,
      } = JSON.parse(this.fetch.firstCall.args[1].body)

      group0.should.equal(userId.toString())
      method0.should.equal('standardHttpRequest')

      job0.method.should.equal('post')
      job0.uri.should.equal(`${thirdPartyDataStoreApiUrl}/user/poll`)
      job0.json.user_ids[0].should.equal(userId.toString())
    })
  })
  describe('deleteProject', function () {
    it('should not call request if there is no project archiver url', async function () {
      await this.TpdsUpdateSender.promises.deleteProject({ projectId })
      this.fetch.should.not.have.been.called
    })
    it('should make a delete request to project archiver', async function () {
      this.settings.apis.project_archiver = { url: projectArchiverUrl }
      await this.TpdsUpdateSender.promises.deleteProject({ projectId })
      this.fetch.should.have.been.calledWith(
        `${projectArchiverUrl}/project/${projectId}`,
        { method: 'DELETE' }
      )
    })
  })

  describe('user not linked to dropbox', function () {
    beforeEach(function () {
      this.UserGetter.promises.getUsers
        .withArgs({
          _id: {
            $in: this.memberIds,
          },
          'dropbox.access_token.uid': { $ne: null },
        })
        .resolves([])
    })
  })

  it('does not make request to tpds', async function () {
    const fileId = '4545345'
    const path = '/some/path/here.jpg'

    await this.TpdsUpdateSender.promises.addFile({
      projectId,
      fileId,
      path,
      projectName,
    })
    this.fetch.should.not.have.been.called
  })
})
