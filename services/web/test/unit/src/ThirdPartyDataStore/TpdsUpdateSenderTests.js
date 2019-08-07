/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender.js'
)
const sinon = require('sinon')
const ath = require('path')
const project_id = 'project_id_here'
const user_id = 'user_id_here'
const read_only_ref_1 = 'read_only_ref_1_id_here'
const collaberator_ref_1 = 'collaberator_ref_1_here'
const project_name = 'project_name_here'

const thirdPartyDataStoreApiUrl = 'http://third-party-json-store.herokuapp.com'
const httpUsername = 'user'
const httpPass = 'pass'
const siteUrl = 'http://www.localhost:3000'
const httpAuthSiteUrl = `http://${httpUsername}:${httpPass}@www.localhost:3000`
const filestoreUrl = 'filestore.sharelatex.com'

describe('TpdsUpdateSender', function() {
  beforeEach(function() {
    this.requestQueuer = function(queue, meth, opts, callback) {}
    const project = { owner_ref: user_id }
    const member_ids = [collaberator_ref_1, read_only_ref_1, user_id]
    this.CollaboratorsHandler = {
      getInvitedMemberIds: sinon.stub().yields(null, member_ids)
    }
    this.ProjectGetter = {
      getProject: sinon.stub().callsArgWith(2, null, project)
    }
    this.docstoreUrl = 'docstore.sharelatex.env'
    this.request = sinon.stub().returns({ pipe() {} })
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
    return (this.updateSender = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': { log() {} },
        '../Project/ProjectGetter': this.ProjectGetter,
        request: this.request,
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        'metrics-sharelatex': {
          inc() {}
        }
      }
    }))
  })

  describe('_enqueue', function() {
    it('should not call request if there is no tpdsworker url', function(done) {
      return this.updateSender._enqueue(null, null, null, err => {
        this.request.called.should.equal(false)
        return done()
      })
    })

    it('should post the message to the tpdsworker', function(done) {
      this.settings.apis.tpdsworker = { url: 'www.tpdsworker.env' }
      const group = 'myproject'
      const method = 'somemethod'
      const job = 'do something'
      this.request.callsArgWith(1)
      return this.updateSender._enqueue(group, method, job, err => {
        const args = this.request.args[0][0]
        args.json.group.should.equal(group)
        args.json.job.should.equal(job)
        args.json.method.should.equal(method)
        args.uri.should.equal(
          'www.tpdsworker.env/enqueue/web_to_tpds_http_requests'
        )
        return done()
      })
    })
  })

  describe('sending updates', function() {
    it('queues a post the file with user and file id', function(done) {
      const file_id = '4545345'
      const path = '/some/path/here.jpg'
      this.updateSender._enqueue = function(uid, method, job, callback) {
        uid.should.equal(project_id)
        job.method.should.equal('post')
        job.streamOrigin.should.equal(
          `${filestoreUrl}/project/${project_id}/file/${file_id}`
        )
        const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${user_id}/entity/${encodeURIComponent(
          project_name
        )}${encodeURIComponent(path)}`
        job.uri.should.equal(expectedUrl)
        job.headers.sl_all_user_ids.should.eql(
          JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id])
        )
        return done()
      }
      return this.updateSender.addFile(
        { project_id, file_id, path, project_name },
        () => {}
      )
    })

    it('post doc with stream origin of docstore', function(done) {
      const doc_id = '4545345'
      const path = '/some/path/here.tex'
      const lines = ['line1', 'line2', 'line3']

      this.updateSender._enqueue = (uid, method, job, callback) => {
        uid.should.equal(project_id)
        job.method.should.equal('post')
        const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${user_id}/entity/${encodeURIComponent(
          project_name
        )}${encodeURIComponent(path)}`
        job.uri.should.equal(expectedUrl)
        job.streamOrigin.should.equal(
          `${this.docstoreUrl}/project/${project_id}/doc/${doc_id}/raw`
        )
        job.headers.sl_all_user_ids.should.eql(
          JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id])
        )
        return done()
      }
      return this.updateSender.addDoc({
        project_id,
        doc_id,
        path,
        docLines: lines,
        project_name
      })
    })

    it('deleting entity', function(done) {
      const path = '/path/here/t.tex'
      this.updateSender._enqueue = function(uid, method, job, callback) {
        uid.should.equal(project_id)
        job.method.should.equal('DELETE')
        const expectedUrl = `${thirdPartyDataStoreApiUrl}/user/${user_id}/entity/${encodeURIComponent(
          project_name
        )}${encodeURIComponent(path)}`
        job.headers.sl_all_user_ids.should.eql(
          JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id])
        )
        job.uri.should.equal(expectedUrl)
        return done()
      }
      return this.updateSender.deleteEntity({ project_id, path, project_name })
    })

    it('moving entity', function(done) {
      const startPath = 'staring/here/file.tex'
      const endPath = 'ending/here/file.tex'
      this.updateSender._enqueue = function(uid, method, job, callback) {
        uid.should.equal(project_id)
        job.method.should.equal('put')
        job.uri.should.equal(
          `${thirdPartyDataStoreApiUrl}/user/${user_id}/entity`
        )
        job.json.startPath.should.equal(`/${project_name}/${startPath}`)
        job.json.endPath.should.equal(`/${project_name}/${endPath}`)
        job.headers.sl_all_user_ids.should.eql(
          JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id])
        )
        return done()
      }
      return this.updateSender.moveEntity({
        project_id,
        startPath,
        endPath,
        project_name
      })
    })

    it('should be able to rename a project using the move entity func', function(done) {
      const oldProjectName = '/oldProjectName/'
      const newProjectName = '/newProjectName/'
      this.updateSender._enqueue = function(uid, method, job, callback) {
        uid.should.equal(project_id)
        job.method.should.equal('put')
        job.uri.should.equal(
          `${thirdPartyDataStoreApiUrl}/user/${user_id}/entity`
        )
        job.json.startPath.should.equal(oldProjectName)
        job.json.endPath.should.equal(newProjectName)
        job.headers.sl_all_user_ids.should.eql(
          JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id])
        )
        return done()
      }
      return this.updateSender.moveEntity({
        project_id,
        project_name: oldProjectName,
        newProjectName
      })
    })

    it('pollDropboxForUser', function(done) {
      this.updateSender._enqueue = sinon.stub().callsArg(3)
      return this.updateSender.pollDropboxForUser(user_id, error => {
        this.updateSender._enqueue
          .calledWith(`poll-dropbox:${user_id}`, 'standardHttpRequest', {
            method: 'POST',
            uri: `${thirdPartyDataStoreApiUrl}/user/poll`,
            json: {
              user_ids: [user_id]
            }
          })
          .should.equal(true)
        return done()
      })
    })
  })
})
