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
const userId = 'user_id_here'
const readOnlyRef = 'read_only_ref_1_id_here'
const collaberatorRef = 'collaberator_ref_1_here'
const projectName = 'project_name_here'

const thirdPartyDataStoreApiUrl = 'http://third-party-json-store.herokuapp.com'
const httpUsername = 'user'
const httpPass = 'pass'
const siteUrl = 'http://www.localhost:3000'
const httpAuthSiteUrl = `http://${httpUsername}:${httpPass}@www.localhost:3000`
const filestoreUrl = 'filestore.sharelatex.com'

describe('TpdsUpdateSender', function() {
  beforeEach(function() {
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
    this.updateSender = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': { log() {} },
        'request-promise-native': this.request,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
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
      const group = 'myproject'
      const method = 'somemethod'
      const job = 'do something'
      await this.updateSender.promises.enqueue(group, method, job)
      const args = this.request.firstCall.args[0]
      args.json.group.should.equal(group)
      args.json.job.should.equal(job)
      args.json.method.should.equal(method)
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

      const { group, job, method } = this.request.firstCall.args[0].json
      group.should.equal(projectId)
      method.should.equal('pipeStreamFrom')
      job.method.should.equal('post')
      job.streamOrigin.should.equal(
        `${filestoreUrl}/project/${projectId}/file/${fileId}`
      )
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job.uri.should.equal(expectedUrl)
      job.headers.sl_all_user_ids.should.equal(
        JSON.stringify([userId, collaberatorRef, readOnlyRef])
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

      const { group, job, method } = this.request.firstCall.args[0].json

      group.should.equal(projectId)
      method.should.equal('pipeStreamFrom')
      job.method.should.equal('post')
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job.uri.should.equal(expectedUrl)
      job.streamOrigin.should.equal(
        `${this.docstoreUrl}/project/${projectId}/doc/${docId}/raw`
      )
      job.headers.sl_all_user_ids.should.eql(
        JSON.stringify([userId, collaberatorRef, readOnlyRef])
      )
    })

    it('deleting entity', async function() {
      const path = '/path/here/t.tex'

      await this.updateSender.promises.deleteEntity({
        project_id: projectId,
        path,
        project_name: projectName
      })

      const { group, job, method } = this.request.firstCall.args[0].json

      group.should.equal(projectId)
      method.should.equal('standardHttpRequest')
      job.method.should.equal('delete')
      const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
        projectName
      )}${encodeURIComponent(path)}`
      job.headers.sl_all_user_ids.should.eql(
        JSON.stringify([userId, collaberatorRef, readOnlyRef])
      )
      job.uri.should.equal(expectedUrl)
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

      const { group, job, method } = this.request.firstCall.args[0].json

      group.should.equal(projectId)
      method.should.equal('standardHttpRequest')
      job.method.should.equal('put')
      job.uri.should.equal(`${thirdPartyDataStoreApiUrl}/user/${userId}/entity`)
      job.json.startPath.should.equal(`/${projectName}/${startPath}`)
      job.json.endPath.should.equal(`/${projectName}/${endPath}`)
      job.headers.sl_all_user_ids.should.eql(
        JSON.stringify([userId, collaberatorRef, readOnlyRef])
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

      const { group, job, method } = this.request.firstCall.args[0].json

      group.should.equal(projectId)
      method.should.equal('standardHttpRequest')
      job.method.should.equal('put')
      job.uri.should.equal(`${thirdPartyDataStoreApiUrl}/user/${userId}/entity`)
      job.json.startPath.should.equal(oldProjectName)
      job.json.endPath.should.equal(newProjectName)
      job.headers.sl_all_user_ids.should.eql(
        JSON.stringify([userId, collaberatorRef, readOnlyRef])
      )
    })

    it('pollDropboxForUser', async function() {
      await this.updateSender.promises.pollDropboxForUser(userId)

      const { group, job, method } = this.request.firstCall.args[0].json

      group.should.equal(`poll-dropbox:${userId}`)
      method.should.equal('standardHttpRequest')

      job.method.should.equal('post')
      job.uri.should.equal(`${thirdPartyDataStoreApiUrl}/user/poll`)
      job.json.user_ids[0].should.equal(userId)
    })
  })
})
