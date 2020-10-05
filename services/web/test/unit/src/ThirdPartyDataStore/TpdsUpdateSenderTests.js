const { ObjectId } = require('mongodb')
const SandboxedModule = require('sandboxed-module')
const chai = require('chai')
const path = require('path')
const sinon = require('sinon')

chai.should()

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
const httpUsername = 'user'
const httpPass = 'pass'
const siteUrl = 'http://www.localhost:3000'
const httpAuthSiteUrl = `http://${httpUsername}:${httpPass}@www.localhost:3000`
const filestoreUrl = 'filestore.sharelatex.com'

describe('TpdsUpdateSender', function() {
  beforeEach(function() {
    this.fakeUser = {
      _id: '12390i'
    }
    this.requestQueuer = function(queue, meth, opts, callback) {}
    const memberIds = [userId, collaberatorRef, readOnlyRef]
    this.CollaboratorsGetter = {
      promises: {
        getInvitedMemberIds: sinon.stub().resolves(memberIds)
      }
    }
    this.docstoreUrl = 'docstore.sharelatex.env'
    this.request = sinon.stub().resolves()
    this.settings = {
      siteUrl,
      httpAuthSiteUrl,
      apis: {
        thirdPartyDataStore: { url: thirdPartyDataStoreApiUrl },
        filestore: {
          url: filestoreUrl
        },
        docstore: {
          pubUrl: this.docstoreUrl
        }
      }
    }
    const getUsers = sinon.stub().resolves(
      memberIds.slice(1).map(userId => {
        return { _id: userId }
      })
    )
    this.UserGetter = {
      promises: { getUsers }
    }
    this.updateSender = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        mongodb: { ObjectId },
        'settings-sharelatex': this.settings,
        'logger-sharelatex': { log() {} },
        'request-promise-native': this.request,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../User/UserGetter.js': this.UserGetter,
        'metrics-sharelatex': {
          inc() {}
        }
      }
    })
  })

  describe('enqueue', function() {
    it('should not call request if there is no tpdsworker url', async function() {
      await this.updateSender.promises.enqueue(null, null, null)
      this.request.should.not.have.been.called
    })

    it('should post the message to the tpdsworker', async function() {
      this.settings.apis.tpdsworker = { url: 'www.tpdsworker.env' }
      const group0 = 'myproject'
      const method0 = 'somemethod0'
      const job0 = 'do something'
      await this.updateSender.promises.enqueue(group0, method0, job0)
      const args = this.request.firstCall.args[0]
      args.json.group.should.equal(group0)
      args.json.job.should.equal(job0)
      args.json.method.should.equal(method0)
      args.uri.should.equal(
        'www.tpdsworker.env/enqueue/web_to_tpds_http_requests'
      )
    })
  })

  describe('sending updates', function() {
    beforeEach(function() {
      this.settings.apis.tpdsworker = { url: 'www.tpdsworker.env' }
    })

    it('queues a post the file with user and file id', async function() {
      const fileId = '4545345'
      const path = '/some/path/here.jpg'

      await this.updateSender.promises.addFile({
        project_id: projectId,
        file_id: fileId,
        path,
        project_name: projectName
      })

      const {
        group: group0,
        job: job0,
        method: method0
      } = this.request.firstCall.args[0].json
      group0.should.equal(userId)
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
      job0.headers.sl_project_owner_user_id.should.equal(userId)

      const { group: group1, job: job1 } = this.request.secondCall.args[0].json
      group1.should.equal(collaberatorRef)
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )
      job1.headers.sl_project_owner_user_id.should.equal(userId)

      const { group: group2, job: job2 } = this.request.thirdCall.args[0].json
      group2.should.equal(readOnlyRef)
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))
      job2.headers.sl_project_owner_user_id.should.equal(userId)

      this.UserGetter.promises.getUsers.should.have.been.calledOnce.and.calledWith(
        {
          _id: {
            $in: [collaberatorRef, readOnlyRef]
          },
          'dropbox.access_token.uid': { $ne: null }
        },
        { _id: 1 }
      )
    })

    it('post doc with stream origin of docstore', async function() {
      const docId = '4545345'
      const path = '/some/path/here.tex'
      const lines = ['line1', 'line2', 'line3']

      await this.updateSender.promises.addDoc({
        project_id: projectId,
        doc_id: docId,
        path,
        docLines: lines,
        project_name: projectName
      })

      const {
        group: group0,
        job: job0,
        method: method0
      } = this.request.firstCall.args[0].json

      group0.should.equal(userId)
      method0.should.equal('pipeStreamFrom')
      job0.method.should.equal('post')
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job0.uri.should.equal(expectedUrl)
      job0.streamOrigin.should.equal(
        `${this.docstoreUrl}/project/${projectId}/doc/${docId}/raw`
      )
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))

      const { group: group1, job: job1 } = this.request.secondCall.args[0].json
      group1.should.equal(collaberatorRef)
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = this.request.thirdCall.args[0].json
      group2.should.equal(readOnlyRef)
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))

      this.UserGetter.promises.getUsers.should.have.been.calledOnce.and.calledWith(
        {
          _id: {
            $in: [collaberatorRef, readOnlyRef]
          },
          'dropbox.access_token.uid': { $ne: null }
        },
        { _id: 1 }
      )
    })

    it('deleting entity', async function() {
      const path = '/path/here/t.tex'

      await this.updateSender.promises.deleteEntity({
        project_id: projectId,
        path,
        project_name: projectName
      })

      const {
        group: group0,
        job: job0,
        method: method0
      } = this.request.firstCall.args[0].json

      group0.should.equal(userId)
      method0.should.equal('standardHttpRequest')
      job0.method.should.equal('delete')
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))
      job0.uri.should.equal(expectedUrl)

      const { group: group1, job: job1 } = this.request.secondCall.args[0].json
      group1.should.equal(collaberatorRef)
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = this.request.thirdCall.args[0].json
      group2.should.equal(readOnlyRef)
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))

      this.UserGetter.promises.getUsers.should.have.been.calledOnce.and.calledWith(
        {
          _id: {
            $in: [collaberatorRef, readOnlyRef]
          },
          'dropbox.access_token.uid': { $ne: null }
        },
        { _id: 1 }
      )
    })

    it('moving entity', async function() {
      const startPath = 'staring/here/file.tex'
      const endPath = 'ending/here/file.tex'

      await this.updateSender.promises.moveEntity({
        project_id: projectId,
        startPath,
        endPath,
        project_name: projectName
      })

      const {
        group: group0,
        job: job0,
        method: method0
      } = this.request.firstCall.args[0].json

      group0.should.equal(userId)
      method0.should.equal('standardHttpRequest')
      job0.method.should.equal('put')
      job0.uri.should.equal(
        `${thirdPartyDataStoreApiUrl}/user/${userId}/entity`
      )
      job0.json.startPath.should.equal(`/${projectName}/${startPath}`)
      job0.json.endPath.should.equal(`/${projectName}/${endPath}`)
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))

      const { group: group1, job: job1 } = this.request.secondCall.args[0].json
      group1.should.equal(collaberatorRef)
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = this.request.thirdCall.args[0].json
      group2.should.equal(readOnlyRef)
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))

      this.UserGetter.promises.getUsers.should.have.been.calledOnce.and.calledWith(
        {
          _id: {
            $in: [collaberatorRef, readOnlyRef]
          },
          'dropbox.access_token.uid': { $ne: null }
        },
        { _id: 1 }
      )
    })

    it('should be able to rename a project using the move entity func', async function() {
      const oldProjectName = '/oldProjectName/'
      const newProjectName = '/newProjectName/'

      await this.updateSender.promises.moveEntity({
        project_id: projectId,
        project_name: oldProjectName,
        newProjectName
      })

      const {
        group: group0,
        job: job0,
        method: method0
      } = this.request.firstCall.args[0].json

      group0.should.equal(userId)
      method0.should.equal('standardHttpRequest')
      job0.method.should.equal('put')
      job0.uri.should.equal(
        `${thirdPartyDataStoreApiUrl}/user/${userId}/entity`
      )
      job0.json.startPath.should.equal(oldProjectName)
      job0.json.endPath.should.equal(newProjectName)
      job0.headers.sl_all_user_ids.should.eql(JSON.stringify([userId]))

      const { group: group1, job: job1 } = this.request.secondCall.args[0].json
      group1.should.equal(collaberatorRef)
      job1.headers.sl_all_user_ids.should.equal(
        JSON.stringify([collaberatorRef])
      )

      const { group: group2, job: job2 } = this.request.thirdCall.args[0].json
      group2.should.equal(readOnlyRef)
      job2.headers.sl_all_user_ids.should.equal(JSON.stringify([readOnlyRef]))

      this.UserGetter.promises.getUsers.should.have.been.calledOnce.and.calledWith(
        {
          _id: {
            $in: [collaberatorRef, readOnlyRef]
          },
          'dropbox.access_token.uid': { $ne: null }
        },
        { _id: 1 }
      )
    })

    it('pollDropboxForUser', async function() {
      await this.updateSender.promises.pollDropboxForUser(userId)

      const {
        group: group0,
        job: job0,
        method: method0
      } = this.request.firstCall.args[0].json

      group0.should.equal(`poll-dropbox:${userId}`)
      method0.should.equal('standardHttpRequest')

      job0.method.should.equal('post')
      job0.uri.should.equal(`${thirdPartyDataStoreApiUrl}/user/poll`)
      job0.json.user_ids[0].should.equal(userId)
    })
  })
})
