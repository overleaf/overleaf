const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const MODULE_PATH = require('path').join(
  __dirname,
  '../../../app/js/OutputController'
)

describe('OutputController', function () {
  describe('createOutputZip', function () {
    beforeEach(function () {
      this.archive = {
        on: sinon.stub(),
        pipe: sinon.stub(),
      }

      this.archiveFilesForBuild = sinon.stub().resolves(this.archive)

      this.OutputController = SandboxedModule.require(MODULE_PATH, {
        requires: {
          './OutputFileArchiveManager': {
            archiveFilesForBuild: this.archiveFilesForBuild,
          },
        },
      })
    })

    describe('when OutputFileArchiveManager creates an archive', function () {
      beforeEach(function (done) {
        this.res = {
          attachment: sinon.stub(),
          setHeader: sinon.stub(),
        }
        this.req = {
          params: {
            project_id: 'project-id-123',
            user_id: 'user-id-123',
            build_id: 'build-id-123',
          },
          query: {
            files: ['output.tex', 'not-output.tex'],
          },
        }
        this.archive.pipe.callsFake(() => done())
        this.OutputController.createOutputZip(this.req, this.res)
      })

      it('does not pass files that do not start with "output" to OutputFileArchiveManager', function () {
        sinon.assert.calledWith(
          this.archiveFilesForBuild,
          'project-id-123',
          'user-id-123',
          'build-id-123',
          ['output.tex']
        )
      })

      it('pipes the archive to the response', function () {
        sinon.assert.calledWith(this.archive.pipe, this.res)
      })

      it('calls the express convenience method to set attachment headers', function () {
        sinon.assert.calledWith(this.res.attachment, 'output.zip')
      })

      it('sets the X-Content-Type-Options header to nosniff', function () {
        sinon.assert.calledWith(
          this.res.setHeader,
          'X-Content-Type-Options',
          'nosniff'
        )
      })
    })

    describe('when OutputFileArchiveManager throws an error', function () {
      let error

      beforeEach(function (done) {
        error = new Error('error message')

        this.archiveFilesForBuild.rejects(error)

        this.res = {
          status: sinon.stub().returnsThis(),
          send: sinon.stub(),
        }
        this.req = {
          params: {
            project_id: 'project-id-123',
            user_id: 'user-id-123',
            build_id: 'build-id-123',
          },
          query: {
            files: ['output.tex'],
          },
        }
        this.OutputController.createOutputZip(
          this.req,
          this.res,
          (this.next = sinon.stub().callsFake(() => {
            done()
          }))
        )
      })

      it('calls next with the error', function () {
        sinon.assert.calledWith(this.next, error)
      })
    })
  })
})
