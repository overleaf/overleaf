import { vi, expect, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'
import Path from 'node:path'
import * as Errors from '../../../app/js/Errors.js'

const modulePath = Path.join(
  import.meta.dirname,
  '../../../app/js/ResourceStateManager'
)

describe('ResourceStateManager', () => {
  beforeEach(async ctx => {
    vi.doMock('fs', () => ({
      default: (ctx.fs = {}),
    }))

    vi.doMock('../../../app/js/SafeReader', () => ({
      default: (ctx.SafeReader = {}),
    }))

    ctx.ResourceStateManager = (await import(modulePath)).default
    ctx.basePath = '/path/to/write/files/to'
    ctx.resources = [
      { path: 'resource-1-mock' },
      { path: 'resource-2-mock' },
      { path: 'resource-3-mock' },
    ]
    ctx.state = '1234567890'
    ctx.resourceFileName = `${ctx.basePath}/.project-sync-state`
    ctx.resourceFileContents = `${ctx.resources[0].path}\n${ctx.resources[1].path}\n${ctx.resources[2].path}\nstateHash:${ctx.state}`
    ctx.callback = sinon.stub()
  })

  describe('saveProjectState', () => {
    beforeEach(ctx => {
      ctx.fs.writeFile = sinon.stub().callsArg(2)
    })

    describe('when the state is specified', () => {
      beforeEach(ctx => {
        ctx.ResourceStateManager.saveProjectState(
          ctx.state,
          ctx.resources,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should write the resource list to disk', ctx => {
        ctx.fs.writeFile
          .calledWith(ctx.resourceFileName, ctx.resourceFileContents)
          .should.equal(true)
      })

      it('should call the callback', ctx => {
        ctx.callback.called.should.equal(true)
      })
    })

    describe('when the state is undefined', () => {
      beforeEach(ctx => {
        ctx.state = undefined
        ctx.fs.unlink = sinon.stub().callsArg(1)
        ctx.ResourceStateManager.saveProjectState(
          ctx.state,
          ctx.resources,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should unlink the resource file', ctx => {
        ctx.fs.unlink.calledWith(ctx.resourceFileName).should.equal(true)
      })

      it('should not write the resource list to disk', ctx => {
        ctx.fs.writeFile.called.should.equal(false)
      })

      it('should call the callback', ctx => {
        ctx.callback.called.should.equal(true)
      })
    })
  })

  describe('checkProjectStateMatches', () => {
    describe('when the state matches', () => {
      beforeEach(ctx => {
        ctx.SafeReader.readFile = sinon
          .stub()
          .callsArgWith(3, null, ctx.resourceFileContents)
        ctx.ResourceStateManager.checkProjectStateMatches(
          ctx.state,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should read the resource file', ctx => {
        ctx.SafeReader.readFile
          .calledWith(ctx.resourceFileName)
          .should.equal(true)
      })

      it('should call the callback with the results', ctx => {
        ctx.callback.calledWithMatch(null, ctx.resources).should.equal(true)
      })
    })

    describe('when the state file is not present', () => {
      beforeEach(ctx => {
        ctx.SafeReader.readFile = sinon.stub().callsArg(3)
        ctx.ResourceStateManager.checkProjectStateMatches(
          ctx.state,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should read the resource file', ctx => {
        ctx.SafeReader.readFile
          .calledWith(ctx.resourceFileName)
          .should.equal(true)
      })

      it('should call the callback with an error', ctx => {
        ctx.callback
          .calledWith(sinon.match(Errors.FilesOutOfSyncError))
          .should.equal(true)

        const message = ctx.callback.args[0][0].message
        expect(message).to.include('invalid state for incremental update')
      })
    })

    describe('when the state does not match', () => {
      beforeEach(ctx => {
        ctx.SafeReader.readFile = sinon
          .stub()
          .callsArgWith(3, null, ctx.resourceFileContents)
        ctx.ResourceStateManager.checkProjectStateMatches(
          'not-the-original-state',
          ctx.basePath,
          ctx.callback
        )
      })

      it('should call the callback with an error', ctx => {
        ctx.callback
          .calledWith(sinon.match(Errors.FilesOutOfSyncError))
          .should.equal(true)

        const message = ctx.callback.args[0][0].message
        expect(message).to.include('invalid state for incremental update')
      })
    })
  })

  describe('checkResourceFiles', () => {
    describe('when all the files are present', () => {
      beforeEach(ctx => {
        ctx.allFiles = [
          ctx.resources[0].path,
          ctx.resources[1].path,
          ctx.resources[2].path,
        ]
        ctx.ResourceStateManager.checkResourceFiles(
          ctx.resources,
          ctx.allFiles,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should call the callback', ctx => {
        ctx.callback.calledWithExactly().should.equal(true)
      })
    })

    describe('when there is a missing file', () => {
      beforeEach(ctx => {
        ctx.allFiles = [ctx.resources[0].path, ctx.resources[1].path]
        ctx.fs.stat = sinon.stub().callsArgWith(1, new Error())
        ctx.ResourceStateManager.checkResourceFiles(
          ctx.resources,
          ctx.allFiles,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should call the callback with an error', ctx => {
        ctx.callback
          .calledWith(sinon.match(Errors.FilesOutOfSyncError))
          .should.equal(true)

        const message = ctx.callback.args[0][0].message
        expect(message).to.include(
          'resource files missing in incremental update'
        )
      })
    })

    describe('when a resource contains a relative path', () => {
      beforeEach(ctx => {
        ctx.resources[0].path = '../foo/bar.tex'
        ctx.allFiles = [
          ctx.resources[0].path,
          ctx.resources[1].path,
          ctx.resources[2].path,
        ]
        ctx.ResourceStateManager.checkResourceFiles(
          ctx.resources,
          ctx.allFiles,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should call the callback with an error', ctx => {
        ctx.callback.calledWith(sinon.match(Error)).should.equal(true)

        const message = ctx.callback.args[0][0].message
        expect(message).to.include('relative path in resource file list')
      })
    })
  })
})
