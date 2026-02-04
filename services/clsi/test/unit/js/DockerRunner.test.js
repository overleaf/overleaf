import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'

import sinon from 'sinon'
import Path from 'node:path'

const modulePath = Path.join(
  import.meta.dirname,
  '../../../app/js/DockerRunner'
)

describe('DockerRunner', () => {
  beforeEach(async ctx => {
    let container
    ctx.container = container = {}

    ctx.Settings = {
      clsi: { docker: {} },
      path: {},
    }
    const Docker = (function () {
      const Docker = class Docker {
        static initClass() {
          this.prototype.getContainer = sinon.stub().returns(container)
          this.prototype.createContainer = sinon.stub().yields(null, container)
          this.prototype.listContainers = sinon.stub()
        }
      }
      Docker.initClass()
      return Docker
    })()

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('dockerode', () => ({
      default: Docker,
    }))

    vi.doMock('fs', () => ({
      default: (ctx.fs = {
        stat: sinon.stub().yields(null, {
          isDirectory() {
            return true
          },
        }),
      }),
    }))

    const Timer = class Timer {
      done() {}
    }

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        Timer,
      },
    }))

    vi.doMock('../../../app/js/LockManager', () => ({
      default: {
        runWithLock(key, runner, callback) {
          return runner(callback)
        },
      },
    }))

    ctx.DockerRunner = (await import(modulePath)).default
    ctx.Docker = Docker
    ctx.getContainer = Docker.prototype.getContainer
    ctx.createContainer = Docker.prototype.createContainer
    ctx.listContainers = Docker.prototype.listContainers

    ctx.directory = '/local/compile/directory'
    ctx.mainFile = 'main-file.tex'
    ctx.compiler = 'pdflatex'
    ctx.image = 'example.com/overleaf/image:2016.2'
    ctx.env = {}
    ctx.callback = sinon.stub()
    ctx.project_id = 'project-id-123'
    ctx.volumes = { '/some/host/dir/compiles/directory': '/compile' }
    ctx.Settings.clsi.docker.image = ctx.defaultImage = 'default-image'
    ctx.Settings.path.sandboxedCompilesHostDirCompiles =
      '/some/host/dir/compiles'
    ctx.Settings.path.sandboxedCompilesHostDirOutput = '/some/host/dir/output'
    ctx.compileGroup = 'compile-group'
    return (ctx.Settings.clsi.docker.env = { PATH: 'mock-path' })
  })

  afterEach(ctx => {
    ctx.DockerRunner.stopContainerMonitor()
  })

  describe('run', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner._getContainerOptions = sinon
          .stub()
          .returns((ctx.options = { mockoptions: 'foo' }))
        ctx.DockerRunner._fingerprintContainer = sinon
          .stub()
          .returns((ctx.fingerprint = 'fingerprint'))

        ctx.containerName = `project-${ctx.project_id}-${ctx.fingerprint}`

        ctx.command = ['mock', 'command', '--outdir=$COMPILE_DIR']
        ctx.command_with_dir = ['mock', 'command', '--outdir=/compile']
        ctx.timeout = 42000
        return resolve()
      })
    })

    describe('successfully', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.DockerRunner._runAndWaitForContainer = sinon
            .stub()
            .callsArgWith(3, null, (ctx.output = 'mock-output'))
          return ctx.DockerRunner.run(
            ctx.project_id,
            ctx.command,
            ctx.directory,
            ctx.image,
            ctx.timeout,
            ctx.env,
            ctx.compileGroup,
            (err, output) => {
              ctx.callback(err, output)
              return resolve()
            }
          )
        })
      })

      it('should generate the options for the container', ctx => {
        return ctx.DockerRunner._getContainerOptions
          .calledWith(ctx.command_with_dir, ctx.image, ctx.volumes, ctx.timeout)
          .should.equal(true)
      })

      it('should generate the fingerprint from the returned options', ctx => {
        return ctx.DockerRunner._fingerprintContainer
          .calledWith(ctx.options)
          .should.equal(true)
      })

      it('should do the run', ctx => {
        return ctx.DockerRunner._runAndWaitForContainer
          .calledWith(ctx.options, ctx.volumes, ctx.timeout)
          .should.equal(true)
      })

      return it('should call the callback', ctx => {
        return ctx.callback.calledWith(null, ctx.output).should.equal(true)
      })
    })

    describe('standard compile', () => {
      beforeEach(ctx => {
        ctx.directory = '/var/lib/overleaf/data/compiles/xyz'
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
        return ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          ctx.compileGroup,
          ctx.callback
        )
      })

      it('should re-write the bind directory', ctx => {
        const volumes =
          ctx.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        return expect(volumes).to.deep.equal({
          '/some/host/dir/compiles/xyz': '/compile',
        })
      })

      return it('should call the callback', ctx => {
        return ctx.callback.calledWith(null, ctx.output).should.equal(true)
      })
    })

    describe('synctex-output', () => {
      beforeEach(ctx => {
        ctx.directory = '/var/lib/overleaf/data/output/xyz/generated-files/id'
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
        ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          'synctex-output',
          ctx.callback
        )
      })

      it('should re-write the bind directory and set ro flag', ctx => {
        const volumes =
          ctx.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        expect(volumes).to.deep.equal({
          '/some/host/dir/output/xyz/generated-files/id': '/compile:ro',
        })
      })

      it('should call the callback', ctx => {
        ctx.callback.calledWith(null, ctx.output).should.equal(true)
      })
    })

    describe('synctex', () => {
      beforeEach(ctx => {
        ctx.directory = '/var/lib/overleaf/data/compile/xyz'
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
        ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          'synctex',
          ctx.callback
        )
      })

      it('should re-write the bind directory', ctx => {
        const volumes =
          ctx.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        expect(volumes).to.deep.equal({
          '/some/host/dir/compiles/xyz': '/compile:ro',
        })
      })

      it('should call the callback', ctx => {
        ctx.callback.calledWith(null, ctx.output).should.equal(true)
      })
    })

    describe('wordcount', () => {
      beforeEach(ctx => {
        ctx.directory = '/var/lib/overleaf/data/compile/xyz'
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
        ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          'wordcount',
          ctx.callback
        )
      })

      it('should re-write the bind directory', ctx => {
        const volumes =
          ctx.DockerRunner._runAndWaitForContainer.lastCall.args[1]
        expect(volumes).to.deep.equal({
          '/some/host/dir/compiles/xyz': '/compile:ro',
        })
      })

      it('should call the callback', ctx => {
        ctx.callback.calledWith(null, ctx.output).should.equal(true)
      })
    })

    describe('when the run throws an error', () => {
      beforeEach(ctx => {
        let firstTime = true
        ctx.output = 'mock-output'
        ctx.DockerRunner._runAndWaitForContainer = (
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
            callback(error)
          } else {
            callback(null, ctx.output)
          }
        }
        sinon.spy(ctx.DockerRunner, '_runAndWaitForContainer')
        ctx.DockerRunner.destroyContainer = sinon.stub().callsArg(3)
        ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          ctx.compileGroup,
          ctx.callback
        )
      })

      it('should do the run twice', ctx => {
        ctx.DockerRunner._runAndWaitForContainer.calledTwice.should.equal(true)
      })

      it('should destroy the container in between', ctx => {
        ctx.DockerRunner.destroyContainer
          .calledWith(ctx.containerName, null)
          .should.equal(true)
      })

      it('should call the callback', ctx => {
        ctx.callback.calledWith(null, ctx.output).should.equal(true)
      })
    })

    describe('with no image', () => {
      beforeEach(ctx => {
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
        ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          null,
          ctx.timeout,
          ctx.env,
          ctx.compileGroup,
          ctx.callback
        )
      })

      it('should use the default image', ctx => {
        ctx.DockerRunner._getContainerOptions
          .calledWith(
            ctx.command_with_dir,
            ctx.defaultImage,
            ctx.volumes,
            ctx.timeout
          )
          .should.equal(true)
      })
    })

    describe('with image override', () => {
      beforeEach(ctx => {
        ctx.Settings.texliveImageNameOveride = 'overrideimage.com/something'
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
        ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          ctx.compileGroup,
          ctx.callback
        )
      })

      it('should use the override and keep the tag', ctx => {
        const image = ctx.DockerRunner._getContainerOptions.args[0][1]
        image.should.equal('overrideimage.com/something/image:2016.2')
      })
    })

    describe('with image restriction', () => {
      beforeEach(ctx => {
        ctx.Settings.clsi.docker.allowedImages = [
          'repo/image:tag1',
          'repo/image:tag2',
        ]
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
      })

      describe('with a valid image', () => {
        beforeEach(ctx => {
          ctx.DockerRunner.run(
            ctx.project_id,
            ctx.command,
            ctx.directory,
            'repo/image:tag1',
            ctx.timeout,
            ctx.env,
            ctx.compileGroup,
            ctx.callback
          )
        })

        it('should setup the container', ctx => {
          ctx.DockerRunner._getContainerOptions.called.should.equal(true)
        })
      })

      describe('with a invalid image', () => {
        beforeEach(ctx => {
          ctx.DockerRunner.run(
            ctx.project_id,
            ctx.command,
            ctx.directory,
            'something/different:evil',
            ctx.timeout,
            ctx.env,
            ctx.compileGroup,
            ctx.callback
          )
        })

        it('should call the callback with an error', ctx => {
          const err = new Error('image not allowed')
          ctx.callback.called.should.equal(true)
          ctx.callback.args[0][0].message.should.equal(err.message)
        })

        it('should not setup the container', ctx => {
          ctx.DockerRunner._getContainerOptions.called.should.equal(false)
        })
      })
    })
  })

  describe('run with _getOptions', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        // this.DockerRunner._getContainerOptions = sinon
        //   .stub()
        //   .returns((this.options = { mockoptions: 'foo' }))
        ctx.DockerRunner._fingerprintContainer = sinon
          .stub()
          .returns((ctx.fingerprint = 'fingerprint'))

        ctx.containerName = `project-${ctx.project_id}-${ctx.fingerprint}`

        ctx.command = ['mock', 'command', '--outdir=$COMPILE_DIR']
        ctx.command_with_dir = ['mock', 'command', '--outdir=/compile']
        ctx.timeout = 42000
        resolve()
      })
    })

    describe('when a compile group config is set', () => {
      beforeEach(ctx => {
        ctx.Settings.clsi.docker.compileGroupConfig = {
          'compile-group': {
            'HostConfig.newProperty': 'new-property',
          },
          'other-group': { otherProperty: 'other-property' },
        }
        ctx.DockerRunner._runAndWaitForContainer = sinon
          .stub()
          .callsArgWith(3, null, (ctx.output = 'mock-output'))
        ctx.DockerRunner.run(
          ctx.project_id,
          ctx.command,
          ctx.directory,
          ctx.image,
          ctx.timeout,
          ctx.env,
          ctx.compileGroup,
          ctx.callback
        )
      })

      it('should set the docker options for the compile group', ctx => {
        const options =
          ctx.DockerRunner._runAndWaitForContainer.lastCall.args[0]
        expect(options.HostConfig).to.deep.include({
          Binds: ['/some/host/dir/compiles/directory:/compile:rw'],
          LogConfig: { Type: 'none', Config: {} },
          CapDrop: ['ALL'],
          SecurityOpt: ['no-new-privileges'],
          newProperty: 'new-property',
        })
      })

      it('should call the callback', ctx => {
        ctx.callback.calledWith(null, ctx.output).should.equal(true)
      })
    })
  })

  describe('_runAndWaitForContainer', () => {
    beforeEach(ctx => {
      ctx.options = {
        mockoptions: 'foo',
        name: (ctx.containerName = 'mock-name'),
      }
      ctx.DockerRunner.startContainer = (
        options,
        volumes,
        attachStreamHandler,
        callback
      ) => {
        attachStreamHandler(null, (ctx.output = 'mock-output'))
        callback(null, (ctx.containerId = 'container-id'))
      }
      sinon.spy(ctx.DockerRunner, 'startContainer')
      ctx.DockerRunner.waitForContainer = sinon
        .stub()
        .callsArgWith(3, null, (ctx.exitCode = 42))
      ctx.DockerRunner._runAndWaitForContainer(
        ctx.options,
        ctx.volumes,
        ctx.timeout,
        ctx.callback
      )
    })

    it('should create/start the container', ctx => {
      ctx.DockerRunner.startContainer
        .calledWith(ctx.options, ctx.volumes)
        .should.equal(true)
    })

    it('should wait for the container to finish', ctx => {
      ctx.DockerRunner.waitForContainer
        .calledWith(ctx.containerName, ctx.timeout)
        .should.equal(true)
    })

    it('should call the callback with the output', ctx => {
      ctx.callback.calledWith(null, ctx.output).should.equal(true)
    })
  })

  describe('startContainer', () => {
    beforeEach(ctx => {
      ctx.attachStreamHandler = sinon.stub()
      ctx.attachStreamHandler.cock = true
      ctx.options = { mockoptions: 'foo', name: 'mock-name' }
      ctx.container.inspect = sinon.stub().callsArgWith(0)
      ctx.DockerRunner.attachToContainer = (
        containerId,
        attachStreamHandler,
        cb
      ) => {
        attachStreamHandler()
        cb()
      }
      sinon.spy(ctx.DockerRunner, 'attachToContainer')
    })

    describe('when the container exists', () => {
      beforeEach(ctx => {
        ctx.container.inspect = sinon.stub().callsArgWith(0)
        ctx.container.start = sinon.stub().yields()

        ctx.DockerRunner.startContainer(
          ctx.options,
          ctx.volumes,
          () => {},
          ctx.callback
        )
      })

      it('should start the container with the given name', ctx => {
        ctx.getContainer.calledWith(ctx.options.name).should.equal(true)
        ctx.container.start.called.should.equal(true)
      })

      it('should not try to create the container', ctx => {
        ctx.createContainer.called.should.equal(false)
      })

      it('should attach to the container', ctx => {
        ctx.DockerRunner.attachToContainer.called.should.equal(true)
      })

      it('should call the callback', ctx => {
        ctx.callback.called.should.equal(true)
      })

      it('should attach before the container starts', ctx => {
        sinon.assert.callOrder(
          ctx.DockerRunner.attachToContainer,
          ctx.container.start
        )
      })
    })

    describe('when the container does not exist', () => {
      beforeEach(ctx => {
        ctx.container.start = sinon.stub().yields()
        ctx.container.inspect = sinon
          .stub()
          .callsArgWith(0, { statusCode: 404 })
        ctx.DockerRunner.startContainer(
          ctx.options,
          ctx.volumes,
          ctx.attachStreamHandler,
          ctx.callback
        )
      })

      it('should create the container', ctx => {
        ctx.createContainer.calledWith(ctx.options).should.equal(true)
      })

      it('should call the callback and stream handler', ctx => {
        ctx.attachStreamHandler.called.should.equal(true)
        ctx.callback.called.should.equal(true)
      })

      it('should attach to the container', ctx => {
        ctx.DockerRunner.attachToContainer.called.should.equal(true)
      })

      it('should attach before the container starts', ctx => {
        sinon.assert.callOrder(
          ctx.DockerRunner.attachToContainer,
          ctx.container.start
        )
      })
    })

    describe('when the container is already running', () => {
      beforeEach(ctx => {
        const error = new Error(
          `HTTP code is 304 which indicates error: server error - start: Cannot start container ${ctx.containerName}: The container MOCKID is already running.`
        )
        error.statusCode = 304
        ctx.container.start = sinon.stub().yields(error)
        ctx.container.inspect = sinon.stub().callsArgWith(0)
        ctx.DockerRunner.startContainer(
          ctx.options,
          ctx.volumes,
          ctx.attachStreamHandler,
          ctx.callback
        )
      })

      it('should not try to create the container', ctx => {
        ctx.createContainer.called.should.equal(false)
      })

      it('should call the callback  and stream handler without an error', ctx => {
        ctx.attachStreamHandler.called.should.equal(true)
        ctx.callback.called.should.equal(true)
      })
    })

    describe.todo(
      'when the container tries to be created, but already has been (race condition)',
      () => {}
    )
  })

  describe('waitForContainer', () => {
    beforeEach(ctx => {
      ctx.containerId = 'container-id'
      ctx.timeout = 5000
      ctx.container.wait = sinon
        .stub()
        .yields(null, { StatusCode: (ctx.statusCode = 42) })
      ctx.container.kill = sinon.stub().yields()
    })

    describe('when the container returns in time', () => {
      beforeEach(ctx => {
        ctx.DockerRunner.waitForContainer(
          ctx.containerId,
          ctx.timeout,
          {},
          ctx.callback
        )
      })

      it('should wait for the container', ctx => {
        ctx.getContainer.calledWith(ctx.containerId).should.equal(true)
        ctx.container.wait.called.should.equal(true)
      })

      it('should call the callback with the exit', ctx => {
        ctx.callback.calledWith(null, ctx.statusCode).should.equal(true)
      })
    })

    describe('when the container is removed before waiting', () => {
      const err = new Error('not found')
      err.statusCode = 404
      beforeEach(ctx => {
        ctx.container.wait = sinon.stub().yields(err)
      })

      describe('AutoRemove not set', () => {
        beforeEach(ctx => {
          ctx.DockerRunner.waitForContainer(
            ctx.containerId,
            ctx.timeout,
            { HostConfig: {} },
            ctx.callback
          )
        })
        it('should wait for the container', ctx => {
          ctx.getContainer.calledWith(ctx.containerId).should.equal(true)
          ctx.container.wait.called.should.equal(true)
        })
        it('should call the callback with the error', ctx => {
          ctx.callback.calledWith(err).should.equal(true)
        })
      })
      describe('AutoRemove=true', () => {
        beforeEach(ctx => {
          ctx.DockerRunner.waitForContainer(
            ctx.containerId,
            ctx.timeout,
            { HostConfig: { AutoRemove: true } },
            ctx.callback
          )
        })
        it('should wait for the container', ctx => {
          ctx.getContainer.calledWith(ctx.containerId).should.equal(true)
          ctx.container.wait.called.should.equal(true)
        })
        it('should call the callback with exit code 0', ctx => {
          ctx.callback.calledWith(null, 0).should.equal(true)
        })
      })
    })

    describe('when the container does not return before the timeout', () => {
      beforeEach(async ctx => {
        await new Promise((resolve, reject) => {
          ctx.container.wait = function (callback) {
            if (callback == null) {
              callback = function () {}
            }
            setTimeout(() => callback(null, { StatusCode: 42 }), 100)
          }
          ctx.timeout = 5
          ctx.DockerRunner.waitForContainer(
            ctx.containerId,
            ctx.timeout,
            {},
            (...args) => {
              ctx.callback(...Array.from(args || []))
              resolve()
            }
          )
        })
      })

      it('should call kill on the container', ctx => {
        ctx.getContainer.calledWith(ctx.containerId).should.equal(true)
        ctx.container.kill.called.should.equal(true)
      })

      it('should call the callback with an error', ctx => {
        ctx.callback.calledWith(sinon.match(Error)).should.equal(true)

        const errorObj = ctx.callback.args[0][0]
        expect(errorObj.message).to.include('container timed out')
        expect(errorObj.timedout).equal(true)
      })
    })
  })

  describe('destroyOldContainers', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        const oneHourInSeconds = 60 * 60
        const oneHourInMilliseconds = oneHourInSeconds * 1000
        const nowInSeconds = Date.now() / 1000
        ctx.containers = [
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
        ctx.DockerRunner.MAX_CONTAINER_AGE = oneHourInMilliseconds
        ctx.listContainers.callsArgWith(1, null, ctx.containers)
        ctx.DockerRunner.destroyContainer = sinon.stub().callsArg(3)
        ctx.DockerRunner.destroyOldContainers(error => {
          ctx.callback(error)
          resolve()
        })
      })
    })

    it('should list all containers', ctx => {
      ctx.listContainers.calledWith({ all: true }).should.equal(true)
    })

    it('should destroy old containers', ctx => {
      ctx.DockerRunner.destroyContainer.callCount.should.equal(1)
      ctx.DockerRunner.destroyContainer
        .calledWith('project-old-container-name', 'old-container-id')
        .should.equal(true)
    })

    it('should not destroy new containers', ctx => {
      ctx.DockerRunner.destroyContainer
        .calledWith('project-new-container-name', 'new-container-id')
        .should.equal(false)
    })

    it('should not destroy non-project containers', ctx => {
      ctx.DockerRunner.destroyContainer
        .calledWith('totally-not-a-project-container', 'some-random-id')
        .should.equal(false)
    })

    it('should callback the callback', ctx => {
      ctx.callback.called.should.equal(true)
    })
  })

  describe('_destroyContainer', () => {
    beforeEach(ctx => {
      ctx.containerId = 'some_id'
      ctx.fakeContainer = { remove: sinon.stub().callsArgWith(1, null) }
      ctx.Docker.prototype.getContainer = sinon
        .stub()
        .returns(ctx.fakeContainer)
    })

    it('should get the container', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner._destroyContainer(ctx.containerId, false, err => {
          if (err) return reject(err)
          ctx.Docker.prototype.getContainer.callCount.should.equal(1)
          ctx.Docker.prototype.getContainer
            .calledWith(ctx.containerId)
            .should.equal(true)
          resolve()
        })
      })
    })

    it('should try to force-destroy the container when shouldForce=true', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner._destroyContainer(ctx.containerId, true, err => {
          if (err) return reject(err)
          ctx.fakeContainer.remove.callCount.should.equal(1)
          ctx.fakeContainer.remove
            .calledWith({ force: true, v: true })
            .should.equal(true)
          resolve()
        })
      })
    })

    it('should not try to force-destroy the container when shouldForce=false', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner._destroyContainer(ctx.containerId, false, err => {
          if (err) return reject(err)
          ctx.fakeContainer.remove.callCount.should.equal(1)
          ctx.fakeContainer.remove
            .calledWith({ force: false, v: true })
            .should.equal(true)
          resolve()
        })
      })
    })

    it('should not produce an error', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner._destroyContainer(ctx.containerId, false, err => {
          expect(err).to.equal(null)
          resolve()
        })
      })
    })

    describe('when the container is already gone', () => {
      beforeEach(ctx => {
        ctx.fakeError = new Error('woops')
        ctx.fakeError.statusCode = 404
        ctx.fakeContainer = {
          remove: sinon.stub().callsArgWith(1, ctx.fakeError),
        }
        ctx.Docker.prototype.getContainer = sinon
          .stub()
          .returns(ctx.fakeContainer)
      })

      it('should not produce an error', async ctx => {
        await new Promise((resolve, reject) => {
          ctx.DockerRunner._destroyContainer(ctx.containerId, false, err => {
            expect(err).to.equal(null)
            resolve()
          })
        })
      })
    })

    describe('when container.destroy produces an error', () => {
      beforeEach(ctx => {
        ctx.fakeError = new Error('woops')
        ctx.fakeError.statusCode = 500
        ctx.fakeContainer = {
          remove: sinon.stub().callsArgWith(1, ctx.fakeError),
        }
        ctx.Docker.prototype.getContainer = sinon
          .stub()
          .returns(ctx.fakeContainer)
      })

      it('should produce an error', async ctx => {
        await new Promise((resolve, reject) => {
          ctx.DockerRunner._destroyContainer(ctx.containerId, false, err => {
            expect(err).to.not.equal(null)
            expect(err).to.equal(ctx.fakeError)
            resolve()
          })
        })
      })
    })
  })

  describe('kill', () => {
    beforeEach(ctx => {
      ctx.containerId = 'some_id'
      ctx.fakeContainer = { kill: sinon.stub().callsArgWith(0, null) }
      ctx.Docker.prototype.getContainer = sinon
        .stub()
        .returns(ctx.fakeContainer)
    })

    it('should get the container', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner.kill(ctx.containerId, err => {
          if (err) return reject(err)
          ctx.Docker.prototype.getContainer.callCount.should.equal(1)
          ctx.Docker.prototype.getContainer
            .calledWith(ctx.containerId)
            .should.equal(true)
          resolve()
        })
      })
    })

    it('should try to force-destroy the container', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner.kill(ctx.containerId, err => {
          if (err) return reject(err)
          ctx.fakeContainer.kill.callCount.should.equal(1)
          resolve()
        })
      })
    })

    it('should not produce an error', async ctx => {
      await new Promise((resolve, reject) => {
        ctx.DockerRunner.kill(ctx.containerId, err => {
          expect(err).to.equal(undefined)
          resolve()
        })
      })
    })

    describe('when the container is not actually running', () => {
      beforeEach(ctx => {
        ctx.fakeError = new Error('woops')
        ctx.fakeError.statusCode = 500
        ctx.fakeError.message =
          'Cannot kill container <whatever> is not running'
        ctx.fakeContainer = {
          kill: sinon.stub().callsArgWith(0, ctx.fakeError),
        }
        ctx.Docker.prototype.getContainer = sinon
          .stub()
          .returns(ctx.fakeContainer)
      })

      it('should not produce an error', async ctx => {
        await new Promise((resolve, reject) => {
          ctx.DockerRunner.kill(ctx.containerId, err => {
            expect(err).to.equal(undefined)
            resolve()
          })
        })
      })
    })

    describe('when container.kill produces a legitimate error', () => {
      beforeEach(ctx => {
        ctx.fakeError = new Error('woops')
        ctx.fakeError.statusCode = 500
        ctx.fakeError.message = 'Totally legitimate reason to throw an error'
        ctx.fakeContainer = {
          kill: sinon.stub().callsArgWith(0, ctx.fakeError),
        }
        ctx.Docker.prototype.getContainer = sinon
          .stub()
          .returns(ctx.fakeContainer)
      })

      it('should produce an error', async ctx => {
        await new Promise((resolve, reject) => {
          ctx.DockerRunner.kill(ctx.containerId, err => {
            expect(err).to.not.equal(undefined)
            expect(err).to.equal(ctx.fakeError)
            resolve()
          })
        })
      })
    })
  })
})
