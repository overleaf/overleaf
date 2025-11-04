/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/DockerRunner'
)
const Path = require('node:path')

describe('DockerRunner', function () {
  beforeEach(function () {
    let container, Docker, Timer
    this.container = container = {}
    this.DockerRunner = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.Settings = {
          clsi: { docker: {} },
          path: {},
        }),
        dockerode: (Docker = (function () {
          Docker = class Docker {
            static initClass() {
              this.prototype.getContainer = sinon.stub().returns(container)
              this.prototype.createContainer = sinon
                .stub()
                .yields(null, container)
              this.prototype.listContainers = sinon.stub()
            }
          }
          Docker.initClass()
          return Docker
        })()),
        fs: (this.fs = {
          stat: sinon.stub().yields(null, {
            isDirectory() {
              return true
            },
          }),
        }),
        '@overleaf/metrics': {
          Timer: (Timer = class Timer {
            done() {}
          }),
        },
        './LockManager': {
          runWithLock(key, runner, callback) {
            return runner(callback)
          },
        },
      },
      globals: { Math }, // used by lodash
    })
    this.Docker = Docker
    this.getContainer = Docker.prototype.getContainer
    this.createContainer = Docker.prototype.createContainer
    this.listContainers = Docker.prototype.listContainers

    this.directory = '/local/compile/directory'
    this.mainFile = 'main-file.tex'
    this.compiler = 'pdflatex'
    this.image = 'example.com/overleaf/image:2016.2'
    this.env = {}
    this.callback = sinon.stub()
    this.project_id = 'project-id-123'
    this.volumes = { '/some/host/dir/compiles/directory': '/compile' }
    this.Settings.clsi.docker.image = this.defaultImage = 'default-image'
    this.Settings.path.sandboxedCompilesHostDirCompiles =
      '/some/host/dir/compiles'
    this.Settings.path.sandboxedCompilesHostDirOutput = '/some/host/dir/output'
    this.compileGroup = 'compile-group'
    return (this.Settings.clsi.docker.env = { PATH: 'mock-path' })
  })

  afterEach(function () {
    this.DockerRunner.stopContainerMonitor()
  })

  describe('run', function () {
    beforeEach(function (done) {
      this.DockerRunner._getContainerOptions = sinon
        .stub()
        .returns((this.options = { mockoptions: 'foo' }))
      this.DockerRunner._fingerprintContainer = sinon
        .stub()
        .returns((this.fingerprint = 'fingerprint'))

      this.name = `project-${this.project_id}-${this.fingerprint}`

      this.command = ['mock', 'command', '--outdir=$COMPILE_DIR']
      this.command_with_dir = ['mock', 'command', '--outdir=/compile']
      this.timeout = 42000
      return done()
    })

    describe('successfully', function () {
      beforeEach(function (done) {
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        return this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          this.compileGroup,
          (err, output) => {
            this.callback(err, output)
            return done()
          }
        )
      })

      it('should generate the options for the container', function () {
        return this.DockerRunner._getContainerOptions
          .calledWith(
            this.command_with_dir,
            this.image,
            this.volumes,
            this.timeout
          )
          .should.equal(true)
      })

      it('should generate the fingerprint from the returned options', function () {
        return this.DockerRunner._fingerprintContainer
          .calledWith(this.options)
          .should.equal(true)
      })

      it('should do the run', function () {
        return this.DockerRunner._runAndWaitForContainer
          .calledWith(this.options, this.volumes, this.timeout)
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.calledWith(null, this.output).should.equal(true)
      })
    })

    describe('standard compile', function () {
      beforeEach(function () {
        this.directory = '/var/lib/overleaf/data/compiles/xyz'
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        return this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          this.compileGroup,
          this.callback
        )
      })

      it('should re-write the bind directory', function () {
        const volumes =
          this.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        return expect(volumes).to.deep.equal({
          '/some/host/dir/compiles/xyz': '/compile',
        })
      })

      return it('should call the callback', function () {
        return this.callback.calledWith(null, this.output).should.equal(true)
      })
    })

    describe('synctex-output', function () {
      beforeEach(function () {
        this.directory = '/var/lib/overleaf/data/output/xyz/generated-files/id'
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          'synctex-output',
          this.callback
        )
      })

      it('should re-write the bind directory and set ro flag', function () {
        const volumes =
          this.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        expect(volumes).to.deep.equal({
          '/some/host/dir/output/xyz/generated-files/id': '/compile:ro',
        })
      })

      it('should call the callback', function () {
        this.callback.calledWith(null, this.output).should.equal(true)
      })
    })

    describe('synctex', function () {
      beforeEach(function () {
        this.directory = '/var/lib/overleaf/data/compile/xyz'
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          'synctex',
          this.callback
        )
      })

      it('should re-write the bind directory', function () {
        const volumes =
          this.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        expect(volumes).to.deep.equal({
          '/some/host/dir/compiles/xyz': '/compile:ro',
        })
      })

      it('should call the callback', function () {
        this.callback.calledWith(null, this.output).should.equal(true)
      })
    })

    describe('wordcount', function () {
      beforeEach(function () {
        this.directory = '/var/lib/overleaf/data/compile/xyz'
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          'wordcount',
          this.callback
        )
      })

      it('should re-write the bind directory', function () {
        const volumes =
          this.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        expect(volumes).to.deep.equal({
          '/some/host/dir/compiles/xyz': '/compile:ro',
        })
      })

      it('should call the callback', function () {
        this.callback.calledWith(null, this.output).should.equal(true)
      })
    })

    describe('when the run throws an error', function () {
      beforeEach(function () {
        let firstTime = true
        this.output = 'mock-output'
        this.DockerRunner._runAndWaitForContainer = (
          options,
          volumes,
          timeout,
          callback
        ) => {
          if (callback == null) {
            callback = function () {}
          }
          if (firstTime) {
            firstTime = false
            const error = new Error('(HTTP code 500) server error - ...')
            error.statusCode = 500
            return callback(error)
          } else {
            return callback(null, this.output)
          }
        }
        sinon.spy(this.DockerRunner, '_runAndWaitForContainer')
        this.DockerRunner.destroyContainer = sinon.stub().callsArg(3)
        return this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          this.compileGroup,
          this.callback
        )
      })

      it('should do the run twice', function () {
        return this.DockerRunner._runAndWaitForContainer.calledTwice.should.equal(
          true
        )
      })

      it('should destroy the container in between', function () {
        return this.DockerRunner.destroyContainer
          .calledWith(this.name, null)
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.calledWith(null, this.output).should.equal(true)
      })
    })

    describe('with no image', function () {
      beforeEach(function () {
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        return this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          null,
          this.timeout,
          this.env,
          this.compileGroup,
          this.callback
        )
      })

      return it('should use the default image', function () {
        return this.DockerRunner._getContainerOptions
          .calledWith(
            this.command_with_dir,
            this.defaultImage,
            this.volumes,
            this.timeout
          )
          .should.equal(true)
      })
    })

    describe('with image override', function () {
      beforeEach(function () {
        this.Settings.texliveImageNameOveride = 'overrideimage.com/something'
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        return this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          this.compileGroup,
          this.callback
        )
      })

      return it('should use the override and keep the tag', function () {
        const image = this.DockerRunner._getContainerOptions.args[0][1]
        return image.should.equal('overrideimage.com/something/image:2016.2')
      })
    })

    describe('with image restriction', function () {
      beforeEach(function () {
        this.Settings.clsi.docker.allowedImages = [
          'repo/image:tag1',
          'repo/image:tag2',
        ]
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
      })

      describe('with a valid image', function () {
        beforeEach(function () {
          this.DockerRunner.run(
            this.project_id,
            this.command,
            this.directory,
            'repo/image:tag1',
            this.timeout,
            this.env,
            this.compileGroup,
            this.callback
          )
        })

        it('should setup the container', function () {
          this.DockerRunner._getContainerOptions.called.should.equal(true)
        })
      })

      describe('with a invalid image', function () {
        beforeEach(function () {
          this.DockerRunner.run(
            this.project_id,
            this.command,
            this.directory,
            'something/different:evil',
            this.timeout,
            this.env,
            this.compileGroup,
            this.callback
          )
        })

        it('should call the callback with an error', function () {
          const err = new Error('image not allowed')
          this.callback.called.should.equal(true)
          this.callback.args[0][0].message.should.equal(err.message)
        })

        it('should not setup the container', function () {
          this.DockerRunner._getContainerOptions.called.should.equal(false)
        })
      })
    })
  })

  describe('run with _getOptions', function () {
    beforeEach(function (done) {
      // this.DockerRunner._getContainerOptions = sinon
      //   .stub()
      //   .returns((this.options = { mockoptions: 'foo' }))
      this.DockerRunner._fingerprintContainer = sinon
        .stub()
        .returns((this.fingerprint = 'fingerprint'))

      this.name = `project-${this.project_id}-${this.fingerprint}`

      this.command = ['mock', 'command', '--outdir=$COMPILE_DIR']
      this.command_with_dir = ['mock', 'command', '--outdir=/compile']
      this.timeout = 42000
      return done()
    })

    describe('when a compile group config is set', function () {
      beforeEach(function () {
        this.Settings.clsi.docker.compileGroupConfig = {
          'compile-group': {
            'HostConfig.newProperty': 'new-property',
          },
          'other-group': { otherProperty: 'other-property' },
        }
        this.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (this.output = 'mock-output'))
        return this.DockerRunner.run(
          this.project_id,
          this.command,
          this.directory,
          this.image,
          this.timeout,
          this.env,
          this.compileGroup,
          this.callback
        )
      })

      it('should set the docker options for the compile group', function () {
        const options =
          this.DockerRunner._runAndWaitForContainer.lastCall.args[0]
        return expect(options.HostConfig).to.deep.include({
          Binds: ['/some/host/dir/compiles/directory:/compile:rw'],
          LogConfig: { Type: 'none', Config: {} },
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges'],
          newProperty: 'new-property',
        })
      })

      return it('should call the callback', function () {
        return this.callback.calledWith(null, this.output).should.equal(true)
      })
    })
  })

  describe('_runAndWaitForContainer', function () {
    beforeEach(function () {
      this.options = { mockoptions: 'foo', name: (this.name = 'mock-name') }
      this.DockerRunner.startContainer = (
        options,
        volumes,
        attachStreamHandler,
        callback
      ) => {
        attachStreamHandler(null, (this.output = 'mock-output'))
        return callback(null, (this.containerId = 'container-id'))
      }
      sinon.spy(this.DockerRunner, 'startContainer')
      this.DockerRunner.waitForContainer = sinon
        .stub()
        .callsArgWith(3, null, (this.exitCode = 42))
      return this.DockerRunner._runAndWaitForContainer(
        this.options,
        this.volumes,
        this.timeout,
        this.callback
      )
    })

    it('should create/start the container', function () {
      return this.DockerRunner.startContainer
        .calledWith(this.options, this.volumes)
        .should.equal(true)
    })

    it('should wait for the container to finish', function () {
      return this.DockerRunner.waitForContainer
        .calledWith(this.name, this.timeout)
        .should.equal(true)
    })

    return it('should call the callback with the output', function () {
      return this.callback.calledWith(null, this.output).should.equal(true)
    })
  })

  describe('startContainer', function () {
    beforeEach(function () {
      this.attachStreamHandler = sinon.stub()
      this.attachStreamHandler.cock = true
      this.options = { mockoptions: 'foo', name: 'mock-name' }
      this.container.inspect = sinon.stub().callsArgWith(0)
      this.DockerRunner.attachToContainer = (
        containerId,
        attachStreamHandler,
        cb
      ) => {
        attachStreamHandler()
        return cb()
      }
      return sinon.spy(this.DockerRunner, 'attachToContainer')
    })

    describe('when the container exists', function () {
      beforeEach(function () {
        this.container.inspect = sinon.stub().callsArgWith(0)
        this.container.start = sinon.stub().yields()

        return this.DockerRunner.startContainer(
          this.options,
          this.volumes,
          () => {},
          this.callback
        )
      })

      it('should start the container with the given name', function () {
        this.getContainer.calledWith(this.options.name).should.equal(true)
        return this.container.start.called.should.equal(true)
      })

      it('should not try to create the container', function () {
        return this.createContainer.called.should.equal(false)
      })

      it('should attach to the container', function () {
        return this.DockerRunner.attachToContainer.called.should.equal(true)
      })

      it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })

      return it('should attach before the container starts', function () {
        return sinon.assert.callOrder(
          this.DockerRunner.attachToContainer,
          this.container.start
        )
      })
    })

    describe('when the container does not exist', function () {
      beforeEach(function () {
        const exists = false
        this.container.start = sinon.stub().yields()
        this.container.inspect = sinon
          .stub()
          .callsArgWith(0, { statusCode: 404 })
        return this.DockerRunner.startContainer(
          this.options,
          this.volumes,
          this.attachStreamHandler,
          this.callback
        )
      })

      it('should create the container', function () {
        return this.createContainer.calledWith(this.options).should.equal(true)
      })

      it('should call the callback and stream handler', function () {
        this.attachStreamHandler.called.should.equal(true)
        return this.callback.called.should.equal(true)
      })

      it('should attach to the container', function () {
        return this.DockerRunner.attachToContainer.called.should.equal(true)
      })

      return it('should attach before the container starts', function () {
        return sinon.assert.callOrder(
          this.DockerRunner.attachToContainer,
          this.container.start
        )
      })
    })

    describe('when the container is already running', function () {
      beforeEach(function () {
        const error = new Error(
          `HTTP code is 304 which indicates error: server error - start: Cannot start container ${this.name}: The container MOCKID is already running.`
        )
        error.statusCode = 304
        this.container.start = sinon.stub().yields(error)
        this.container.inspect = sinon.stub().callsArgWith(0)
        return this.DockerRunner.startContainer(
          this.options,
          this.volumes,
          this.attachStreamHandler,
          this.callback
        )
      })

      it('should not try to create the container', function () {
        return this.createContainer.called.should.equal(false)
      })

      return it('should call the callback  and stream handler without an error', function () {
        this.attachStreamHandler.called.should.equal(true)
        return this.callback.called.should.equal(true)
      })
    })

    return describe('when the container tries to be created, but already has been (race condition)', function () {})
  })

  describe('waitForContainer', function () {
    beforeEach(function () {
      this.containerId = 'container-id'
      this.timeout = 5000
      this.container.wait = sinon
        .stub()
        .yields(null, { StatusCode: (this.statusCode = 42) })
      return (this.container.kill = sinon.stub().yields())
    })

    describe('when the container returns in time', function () {
      beforeEach(function () {
        return this.DockerRunner.waitForContainer(
          this.containerId,
          this.timeout,
          {},
          this.callback
        )
      })

      it('should wait for the container', function () {
        this.getContainer.calledWith(this.containerId).should.equal(true)
        return this.container.wait.called.should.equal(true)
      })

      return it('should call the callback with the exit', function () {
        return this.callback
          .calledWith(null, this.statusCode)
          .should.equal(true)
      })
    })

    describe('when the container is removed before waiting', function () {
      const err = new Error('not found')
      err.statusCode = 404
      beforeEach(function () {
        this.container.wait = sinon.stub().yields(err)
      })

      describe('AutoRemove not set', function () {
        beforeEach(function () {
          this.DockerRunner.waitForContainer(
            this.containerId,
            this.timeout,
            { HostConfig: {} },
            this.callback
          )
        })
        it('should wait for the container', function () {
          this.getContainer.calledWith(this.containerId).should.equal(true)
          this.container.wait.called.should.equal(true)
        })
        it('should call the callback with the error', function () {
          this.callback.calledWith(err).should.equal(true)
        })
      })
      describe('AutoRemove=true', function () {
        beforeEach(function () {
          this.DockerRunner.waitForContainer(
            this.containerId,
            this.timeout,
            { HostConfig: { AutoRemove: true } },
            this.callback
          )
        })
        it('should wait for the container', function () {
          this.getContainer.calledWith(this.containerId).should.equal(true)
          this.container.wait.called.should.equal(true)
        })
        it('should call the callback with exit code 0', function () {
          this.callback.calledWith(null, 0).should.equal(true)
        })
      })
    })

    return describe('when the container does not return before the timeout', function () {
      beforeEach(function (done) {
        this.container.wait = function (callback) {
          if (callback == null) {
            callback = function () {}
          }
          return setTimeout(() => callback(null, { StatusCode: 42 }), 100)
        }
        this.timeout = 5
        return this.DockerRunner.waitForContainer(
          this.containerId,
          this.timeout,
          {},
          (...args) => {
            this.callback(...Array.from(args || []))
            return done()
          }
        )
      })

      it('should call kill on the container', function () {
        this.getContainer.calledWith(this.containerId).should.equal(true)
        return this.container.kill.called.should.equal(true)
      })

      it('should call the callback with an error', function () {
        this.callback.calledWith(sinon.match(Error)).should.equal(true)

        const errorObj = this.callback.args[0][0]
        expect(errorObj.message).to.include('container timed out')
        expect(errorObj.timedout).equal(true)
      })
    })
  })

  describe('destroyOldContainers', function () {
    beforeEach(function (done) {
      const oneHourInSeconds = 60 * 60
      const oneHourInMilliseconds = oneHourInSeconds * 1000
      const nowInSeconds = Date.now() / 1000
      this.containers = [
        {
          Name: '/project-old-container-name',
          Id: 'old-container-id',
          Created: nowInSeconds - oneHourInSeconds - 100,
        },
        {
          Name: '/project-new-container-name',
          Id: 'new-container-id',
          Created: nowInSeconds - oneHourInSeconds + 100,
        },
        {
          Name: '/totally-not-a-project-container',
          Id: 'some-random-id',
          Created: nowInSeconds - 2 * oneHourInSeconds,
        },
      ]
      this.DockerRunner.MAX_CONTAINER_AGE = oneHourInMilliseconds
      this.listContainers.callsArgWith(1, null, this.containers)
      this.DockerRunner.destroyContainer = sinon.stub().callsArg(3)
      return this.DockerRunner.destroyOldContainers(error => {
        this.callback(error)
        return done()
      })
    })

    it('should list all containers', function () {
      return this.listContainers.calledWith({ all: true }).should.equal(true)
    })

    it('should destroy old containers', function () {
      this.DockerRunner.destroyContainer.callCount.should.equal(1)
      return this.DockerRunner.destroyContainer
        .calledWith('project-old-container-name', 'old-container-id')
        .should.equal(true)
    })

    it('should not destroy new containers', function () {
      return this.DockerRunner.destroyContainer
        .calledWith('project-new-container-name', 'new-container-id')
        .should.equal(false)
    })

    it('should not destroy non-project containers', function () {
      return this.DockerRunner.destroyContainer
        .calledWith('totally-not-a-project-container', 'some-random-id')
        .should.equal(false)
    })

    return it('should callback the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('_destroyContainer', function () {
    beforeEach(function () {
      this.containerId = 'some_id'
      this.fakeContainer = { remove: sinon.stub().callsArgWith(1, null) }
      return (this.Docker.prototype.getContainer = sinon
        .stub()
        .returns(this.fakeContainer))
    })

    it('should get the container', function (done) {
      return this.DockerRunner._destroyContainer(
        this.containerId,
        false,
        err => {
          if (err) return done(err)
          this.Docker.prototype.getContainer.callCount.should.equal(1)
          this.Docker.prototype.getContainer
            .calledWith(this.containerId)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should try to force-destroy the container when shouldForce=true', function (done) {
      return this.DockerRunner._destroyContainer(
        this.containerId,
        true,
        err => {
          if (err) return done(err)
          this.fakeContainer.remove.callCount.should.equal(1)
          this.fakeContainer.remove
            .calledWith({ force: true, v: true })
            .should.equal(true)
          return done()
        }
      )
    })

    it('should not try to force-destroy the container when shouldForce=false', function (done) {
      return this.DockerRunner._destroyContainer(
        this.containerId,
        false,
        err => {
          if (err) return done(err)
          this.fakeContainer.remove.callCount.should.equal(1)
          this.fakeContainer.remove
            .calledWith({ force: false, v: true })
            .should.equal(true)
          return done()
        }
      )
    })

    it('should not produce an error', function (done) {
      return this.DockerRunner._destroyContainer(
        this.containerId,
        false,
        err => {
          expect(err).to.equal(null)
          return done()
        }
      )
    })

    describe('when the container is already gone', function () {
      beforeEach(function () {
        this.fakeError = new Error('woops')
        this.fakeError.statusCode = 404
        this.fakeContainer = {
          remove: sinon.stub().callsArgWith(1, this.fakeError),
        }
        return (this.Docker.prototype.getContainer = sinon
          .stub()
          .returns(this.fakeContainer))
      })

      return it('should not produce an error', function (done) {
        return this.DockerRunner._destroyContainer(
          this.containerId,
          false,
          err => {
            expect(err).to.equal(null)
            return done()
          }
        )
      })
    })

    return describe('when container.destroy produces an error', function (done) {
      beforeEach(function () {
        this.fakeError = new Error('woops')
        this.fakeError.statusCode = 500
        this.fakeContainer = {
          remove: sinon.stub().callsArgWith(1, this.fakeError),
        }
        return (this.Docker.prototype.getContainer = sinon
          .stub()
          .returns(this.fakeContainer))
      })

      return it('should produce an error', function (done) {
        return this.DockerRunner._destroyContainer(
          this.containerId,
          false,
          err => {
            expect(err).to.not.equal(null)
            expect(err).to.equal(this.fakeError)
            return done()
          }
        )
      })
    })
  })

  return describe('kill', function () {
    beforeEach(function () {
      this.containerId = 'some_id'
      this.fakeContainer = { kill: sinon.stub().callsArgWith(0, null) }
      return (this.Docker.prototype.getContainer = sinon
        .stub()
        .returns(this.fakeContainer))
    })

    it('should get the container', function (done) {
      return this.DockerRunner.kill(this.containerId, err => {
        if (err) return done(err)
        this.Docker.prototype.getContainer.callCount.should.equal(1)
        this.Docker.prototype.getContainer
          .calledWith(this.containerId)
          .should.equal(true)
        return done()
      })
    })

    it('should try to force-destroy the container', function (done) {
      return this.DockerRunner.kill(this.containerId, err => {
        if (err) return done(err)
        this.fakeContainer.kill.callCount.should.equal(1)
        return done()
      })
    })

    it('should not produce an error', function (done) {
      return this.DockerRunner.kill(this.containerId, err => {
        expect(err).to.equal(undefined)
        return done()
      })
    })

    describe('when the container is not actually running', function () {
      beforeEach(function () {
        this.fakeError = new Error('woops')
        this.fakeError.statusCode = 500
        this.fakeError.message =
          'Cannot kill container <whatever> is not running'
        this.fakeContainer = {
          kill: sinon.stub().callsArgWith(0, this.fakeError),
        }
        return (this.Docker.prototype.getContainer = sinon
          .stub()
          .returns(this.fakeContainer))
      })

      return it('should not produce an error', function (done) {
        return this.DockerRunner.kill(this.containerId, err => {
          expect(err).to.equal(undefined)
          return done()
        })
      })
    })

    return describe('when container.kill produces a legitimate error', function (done) {
      beforeEach(function () {
        this.fakeError = new Error('woops')
        this.fakeError.statusCode = 500
        this.fakeError.message = 'Totally legitimate reason to throw an error'
        this.fakeContainer = {
          kill: sinon.stub().callsArgWith(0, this.fakeError),
        }
        return (this.Docker.prototype.getContainer = sinon
          .stub()
          .returns(this.fakeContainer))
      })

      return it('should produce an error', function (done) {
        return this.DockerRunner.kill(this.containerId, err => {
          expect(err).to.not.equal(undefined)
          expect(err).to.equal(this.fakeError)
          return done()
        })
      })
    })
  })
})
