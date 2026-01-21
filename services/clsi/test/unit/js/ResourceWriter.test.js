import { vi, expect, describe, beforeEach, it } from 'vitest'

import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/ResourceWriter'
)

describe('ResourceWriter', () => {
  beforeEach(async ctx => {
    let Timer

    vi.doMock('fs', () => ({
      default: (ctx.fs = {
        mkdir: sinon.stub().callsArg(1),
        unlink: sinon.stub().callsArg(1),
      }),
    }))

    vi.doMock('../../../app/js/ResourceStateManager', () => ({
      default: (ctx.ResourceStateManager = {}),
    }))

    vi.doMock('../../../app/js/UrlCache', () => ({
      default: (ctx.UrlCache = {
        createProjectDir: sinon.stub().yields(),
      }),
    }))

    vi.doMock('../../../app/js/OutputFileFinder', () => ({
      default: (ctx.OutputFileFinder = {}),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      // Mocks allow us to import Metrics.js twice without getting errors.
      prom: {
        Gauge: sinon.stub(),
        Histogram: sinon.stub(),
        Counter: sinon.stub(),
      },
      default: (ctx.Metrics = {
        inc: sinon.stub(),
        Timer: (Timer = (function () {
          Timer = class Timer {
            static initClass() {
              this.prototype.done = sinon.stub()
            }
          }
          Timer.initClass()
          return Timer
        })()),
      }),
    }))

    ctx.ResourceWriter = (await import(modulePath)).default
    ctx.project_id = 'project-id-123'
    ctx.basePath = '/path/to/write/files/to'
    return (ctx.callback = sinon.stub())
  })

  describe('syncResourcesToDisk on a full request', () => {
    beforeEach(ctx => {
      ctx.resources = ['resource-1-mock', 'resource-2-mock', 'resource-3-mock']
      ctx.request = {
        project_id: ctx.project_id,
        syncState: (ctx.syncState = '0123456789abcdef'),
        resources: ctx.resources,
      }
      ctx.ResourceWriter._writeResourceToDisk = sinon.stub().callsArg(3)
      ctx.ResourceWriter._removeExtraneousFiles = sinon.stub().yields(null)
      ctx.ResourceStateManager.saveProjectState = sinon.stub().callsArg(3)
      return ctx.ResourceWriter.syncResourcesToDisk(
        ctx.request,
        ctx.basePath,
        ctx.callback
      )
    })

    it('should remove old files', ctx => {
      return ctx.ResourceWriter._removeExtraneousFiles
        .calledWith(ctx.request, ctx.resources, ctx.basePath)
        .should.equal(true)
    })

    it('should write each resource to disk', ctx => {
      return Array.from(ctx.resources).map(resource =>
        ctx.ResourceWriter._writeResourceToDisk
          .calledWith(ctx.project_id, resource, ctx.basePath)
          .should.equal(true)
      )
    })

    it('should store the sync state and resource list', ctx => {
      return ctx.ResourceStateManager.saveProjectState
        .calledWith(ctx.syncState, ctx.resources, ctx.basePath)
        .should.equal(true)
    })

    return it('should call the callback', ctx => {
      return ctx.callback.called.should.equal(true)
    })
  })

  describe('syncResourcesToDisk on an incremental update', () => {
    beforeEach(ctx => {
      ctx.resources = ['resource-1-mock']
      ctx.request = {
        project_id: ctx.project_id,
        syncType: 'incremental',
        syncState: (ctx.syncState = '1234567890abcdef'),
        resources: ctx.resources,
      }
      ctx.fullResources = ctx.resources.concat(['file-1'])
      ctx.ResourceWriter._writeResourceToDisk = sinon.stub().callsArg(3)
      ctx.ResourceWriter._removeExtraneousFiles = sinon
        .stub()
        .yields(null, (ctx.outputFiles = []), (ctx.allFiles = []))
      ctx.ResourceStateManager.checkProjectStateMatches = sinon
        .stub()
        .callsArgWith(2, null, ctx.fullResources)
      ctx.ResourceStateManager.saveProjectState = sinon.stub().callsArg(3)
      ctx.ResourceStateManager.checkResourceFiles = sinon.stub().callsArg(3)
      return ctx.ResourceWriter.syncResourcesToDisk(
        ctx.request,
        ctx.basePath,
        ctx.callback
      )
    })

    it('should check the sync state matches', ctx => {
      return ctx.ResourceStateManager.checkProjectStateMatches
        .calledWith(ctx.syncState, ctx.basePath)
        .should.equal(true)
    })

    it('should remove old files', ctx => {
      return ctx.ResourceWriter._removeExtraneousFiles
        .calledWith(ctx.request, ctx.fullResources, ctx.basePath)
        .should.equal(true)
    })

    it('should check each resource exists', ctx => {
      return ctx.ResourceStateManager.checkResourceFiles
        .calledWith(ctx.fullResources, ctx.allFiles, ctx.basePath)
        .should.equal(true)
    })

    it('should write each resource to disk', ctx => {
      return Array.from(ctx.resources).map(resource =>
        ctx.ResourceWriter._writeResourceToDisk
          .calledWith(ctx.project_id, resource, ctx.basePath)
          .should.equal(true)
      )
    })

    return it('should call the callback', ctx => {
      return ctx.callback.called.should.equal(true)
    })
  })

  describe('syncResourcesToDisk on an incremental update when the state does not match', () => {
    beforeEach(ctx => {
      ctx.resources = ['resource-1-mock']
      ctx.request = {
        project_id: ctx.project_id,
        syncType: 'incremental',
        syncState: (ctx.syncState = '1234567890abcdef'),
        resources: ctx.resources,
      }
      ctx.ResourceStateManager.checkProjectStateMatches = sinon
        .stub()
        .callsArgWith(2, (ctx.error = new Error()))
      return ctx.ResourceWriter.syncResourcesToDisk(
        ctx.request,
        ctx.basePath,
        ctx.callback
      )
    })

    it('should check whether the sync state matches', ctx => {
      return ctx.ResourceStateManager.checkProjectStateMatches
        .calledWith(ctx.syncState, ctx.basePath)
        .should.equal(true)
    })

    return it('should call the callback with an error', ctx => {
      return ctx.callback.calledWith(ctx.error).should.equal(true)
    })
  })

  describe('_removeExtraneousFiles', () => {
    beforeEach(ctx => {
      ctx.output_files = [
        {
          path: 'output.pdf',
          type: 'pdf',
        },
        {
          path: 'extra/file.tex',
          type: 'tex',
        },
        {
          path: 'extra.aux',
          type: 'aux',
        },
        {
          path: 'cache/_chunk1',
        },
        {
          path: 'figures/image-eps-converted-to.pdf',
          type: 'pdf',
        },
        {
          path: 'foo/main-figure0.md5',
          type: 'md5',
        },
        {
          path: 'foo/main-figure0.dpth',
          type: 'dpth',
        },
        {
          path: 'foo/main-figure0.pdf',
          type: 'pdf',
        },
        {
          path: '_minted-main/default-pyg-prefix.pygstyle',
          type: 'pygstyle',
        },
        {
          path: '_minted-main/default.pygstyle',
          type: 'pygstyle',
        },
        {
          path: '_minted-main/35E248B60965545BD232AE9F0FE9750D504A7AF0CD3BAA7542030FC560DFCC45.pygtex',
          type: 'pygtex',
        },
        {
          path: '_markdown_main/30893013dec5d869a415610079774c2f.md.tex',
          type: 'tex',
        },
        {
          path: 'output.stdout',
        },
        {
          path: 'output.stderr',
        },
      ]
      ctx.resources = 'mock-resources'
      ctx.request = {
        project_id: ctx.project_id,
        syncType: 'incremental',
        syncState: (ctx.syncState = '1234567890abcdef'),
        resources: ctx.resources,
        metricsOpts: { path: 'foo' },
      }
      ctx.OutputFileFinder.findOutputFiles = sinon
        .stub()
        .callsArgWith(2, null, ctx.output_files)
      ctx.ResourceWriter._deleteFileIfNotDirectory = sinon.stub().callsArg(1)
      return ctx.ResourceWriter._removeExtraneousFiles(
        ctx.request,
        ctx.resources,
        ctx.basePath,
        ctx.callback
      )
    })

    it('should find the existing output files', ctx => {
      return ctx.OutputFileFinder.findOutputFiles
        .calledWith(ctx.resources, ctx.basePath)
        .should.equal(true)
    })

    it('should delete the output files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'output.pdf'))
        .should.equal(true)
    })

    it('should delete the stdout log file', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'output.stdout'))
        .should.equal(true)
    })

    it('should delete the stderr log file', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'output.stderr'))
        .should.equal(true)
    })

    it('should delete the extra files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'extra/file.tex'))
        .should.equal(true)
    })

    it('should not delete the extra aux files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'extra.aux'))
        .should.equal(false)
    })

    it('should not delete the knitr cache file', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'cache/_chunk1'))
        .should.equal(false)
    })

    it('should not delete the epstopdf converted files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(ctx.basePath, 'figures/image-eps-converted-to.pdf')
        )
        .should.equal(false)
    })

    it('should not delete the tikz md5 files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'foo/main-figure0.md5'))
        .should.equal(false)
    })

    it('should not delete the tikz dpth files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'foo/main-figure0.dpth'))
        .should.equal(false)
    })

    it('should not delete the tikz pdf files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, 'foo/main-figure0.pdf'))
        .should.equal(false)
    })

    it('should not delete the minted pygstyle files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(ctx.basePath, '_minted-main/default-pyg-prefix.pygstyle')
        )
        .should.equal(false)
    })

    it('should not delete the minted default pygstyle files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(ctx.basePath, '_minted-main/default.pygstyle'))
        .should.equal(false)
    })

    it('should not delete the minted default pygtex files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(
            ctx.basePath,
            '_minted-main/35E248B60965545BD232AE9F0FE9750D504A7AF0CD3BAA7542030FC560DFCC45.pygtex'
          )
        )
        .should.equal(false)
    })

    it('should not delete the markdown md.tex files', ctx => {
      return ctx.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(
            ctx.basePath,
            '_markdown_main/30893013dec5d869a415610079774c2f.md.tex'
          )
        )
        .should.equal(false)
    })

    it('should call the callback', ctx => {
      return ctx.callback.called.should.equal(true)
    })

    return it('should time the request', ctx => {
      return ctx.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('_writeResourceToDisk', () => {
    describe('with a url based resource', () => {
      beforeEach(ctx => {
        ctx.fs.mkdir = sinon.stub().callsArg(2)
        ctx.resource = {
          path: 'main.tex',
          url: 'http://www.example.com/primary/main.tex',
          fallbackURL: 'http://fallback.example.com/fallback/main.tex',
          modified: Date.now(),
        }
        ctx.UrlCache.downloadUrlToFile = sinon
          .stub()
          .callsArgWith(5, 'fake error downloading file')
        return ctx.ResourceWriter._writeResourceToDisk(
          ctx.project_id,
          ctx.resource,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should ensure the directory exists', ctx => {
        ctx.fs.mkdir
          .calledWith(path.dirname(path.join(ctx.basePath, ctx.resource.path)))
          .should.equal(true)
      })

      it('should write the URL from the cache', ctx => {
        return ctx.UrlCache.downloadUrlToFile
          .calledWith(
            ctx.project_id,
            ctx.resource.url,
            ctx.resource.fallbackURL,
            path.join(ctx.basePath, ctx.resource.path),
            ctx.resource.modified
          )
          .should.equal(true)
      })

      it('should call the callback', ctx => {
        return ctx.callback.called.should.equal(true)
      })

      return it('should not return an error if the resource writer errored', ctx => {
        return expect(ctx.callback.args[0][0]).not.to.exist
      })
    })

    describe('with a content based resource', () => {
      beforeEach(ctx => {
        ctx.resource = {
          path: 'main.tex',
          content: 'Hello world',
        }
        ctx.fs.writeFile = sinon.stub().callsArg(2)
        ctx.fs.mkdir = sinon.stub().callsArg(2)
        return ctx.ResourceWriter._writeResourceToDisk(
          ctx.project_id,
          ctx.resource,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should ensure the directory exists', ctx => {
        return ctx.fs.mkdir
          .calledWith(path.dirname(path.join(ctx.basePath, ctx.resource.path)))
          .should.equal(true)
      })

      it('should write the contents to disk', ctx => {
        return ctx.fs.writeFile
          .calledWith(
            path.join(ctx.basePath, ctx.resource.path),
            ctx.resource.content
          )
          .should.equal(true)
      })

      return it('should call the callback', ctx => {
        return ctx.callback.called.should.equal(true)
      })
    })

    return describe('with a file path that breaks out of the root folder', () => {
      beforeEach(ctx => {
        ctx.resource = {
          path: '../../main.tex',
          content: 'Hello world',
        }
        ctx.fs.writeFile = sinon.stub().callsArg(2)
        return ctx.ResourceWriter._writeResourceToDisk(
          ctx.project_id,
          ctx.resource,
          ctx.basePath,
          ctx.callback
        )
      })

      it('should not write to disk', ctx => {
        return ctx.fs.writeFile.called.should.equal(false)
      })

      it('should return an error', ctx => {
        ctx.callback.calledWith(sinon.match(Error)).should.equal(true)

        const message = ctx.callback.args[0][0].message
        expect(message).to.include('resource path is outside root directory')
      })
    })
  })

  return describe('checkPath', () => {
    describe('with a valid path', () => {
      beforeEach(ctx => {
        return ctx.ResourceWriter.checkPath('foo', 'bar', ctx.callback)
      })

      return it('should return the joined path', ctx => {
        return ctx.callback.calledWith(null, 'foo/bar').should.equal(true)
      })
    })

    describe('with an invalid path', () => {
      beforeEach(ctx => {
        ctx.ResourceWriter.checkPath('foo', 'baz/../../bar', ctx.callback)
      })

      it('should return an error', ctx => {
        ctx.callback.calledWith(sinon.match(Error)).should.equal(true)

        const message = ctx.callback.args[0][0].message
        expect(message).to.include('resource path is outside root directory')
      })
    })

    describe('with another invalid path matching on a prefix', () => {
      beforeEach(ctx => {
        return ctx.ResourceWriter.checkPath(
          'foo',
          '../foobar/baz',
          ctx.callback
        )
      })

      it('should return an error', ctx => {
        ctx.callback.calledWith(sinon.match(Error)).should.equal(true)

        const message = ctx.callback.args[0][0].message
        expect(message).to.include('resource path is outside root directory')
      })
    })
  })
})
