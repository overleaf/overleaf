/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/ResourceWriter'
)
const path = require('node:path')

describe('ResourceWriter', function () {
  beforeEach(function () {
    let Timer
    this.ResourceWriter = SandboxedModule.require(modulePath, {
      singleOnly: true,
      requires: {
        fs: (this.fs = {
          mkdir: sinon.stub().callsArg(1),
          unlink: sinon.stub().callsArg(1),
        }),
        './ResourceStateManager': (this.ResourceStateManager = {}),
        './UrlCache': (this.UrlCache = {
          createProjectDir: sinon.stub().yields(),
        }),
        './OutputFileFinder': (this.OutputFileFinder = {}),
        './Metrics': (this.Metrics = {
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
      },
    })
    this.project_id = 'project-id-123'
    this.basePath = '/path/to/write/files/to'
    return (this.callback = sinon.stub())
  })

  describe('syncResourcesToDisk on a full request', function () {
    beforeEach(function () {
      this.resources = ['resource-1-mock', 'resource-2-mock', 'resource-3-mock']
      this.request = {
        project_id: this.project_id,
        syncState: (this.syncState = '0123456789abcdef'),
        resources: this.resources,
      }
      this.ResourceWriter._writeResourceToDisk = sinon.stub().callsArg(3)
      this.ResourceWriter._removeExtraneousFiles = sinon.stub().yields(null)
      this.ResourceStateManager.saveProjectState = sinon.stub().callsArg(3)
      return this.ResourceWriter.syncResourcesToDisk(
        this.request,
        this.basePath,
        this.callback
      )
    })

    it('should remove old files', function () {
      return this.ResourceWriter._removeExtraneousFiles
        .calledWith(this.request, this.resources, this.basePath)
        .should.equal(true)
    })

    it('should write each resource to disk', function () {
      return Array.from(this.resources).map(resource =>
        this.ResourceWriter._writeResourceToDisk
          .calledWith(this.project_id, resource, this.basePath)
          .should.equal(true)
      )
    })

    it('should store the sync state and resource list', function () {
      return this.ResourceStateManager.saveProjectState
        .calledWith(this.syncState, this.resources, this.basePath)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('syncResourcesToDisk on an incremental update', function () {
    beforeEach(function () {
      this.resources = ['resource-1-mock']
      this.request = {
        project_id: this.project_id,
        syncType: 'incremental',
        syncState: (this.syncState = '1234567890abcdef'),
        resources: this.resources,
      }
      this.fullResources = this.resources.concat(['file-1'])
      this.ResourceWriter._writeResourceToDisk = sinon.stub().callsArg(3)
      this.ResourceWriter._removeExtraneousFiles = sinon
        .stub()
        .yields(null, (this.outputFiles = []), (this.allFiles = []))
      this.ResourceStateManager.checkProjectStateMatches = sinon
        .stub()
        .callsArgWith(2, null, this.fullResources)
      this.ResourceStateManager.saveProjectState = sinon.stub().callsArg(3)
      this.ResourceStateManager.checkResourceFiles = sinon.stub().callsArg(3)
      return this.ResourceWriter.syncResourcesToDisk(
        this.request,
        this.basePath,
        this.callback
      )
    })

    it('should check the sync state matches', function () {
      return this.ResourceStateManager.checkProjectStateMatches
        .calledWith(this.syncState, this.basePath)
        .should.equal(true)
    })

    it('should remove old files', function () {
      return this.ResourceWriter._removeExtraneousFiles
        .calledWith(this.request, this.fullResources, this.basePath)
        .should.equal(true)
    })

    it('should check each resource exists', function () {
      return this.ResourceStateManager.checkResourceFiles
        .calledWith(this.fullResources, this.allFiles, this.basePath)
        .should.equal(true)
    })

    it('should write each resource to disk', function () {
      return Array.from(this.resources).map(resource =>
        this.ResourceWriter._writeResourceToDisk
          .calledWith(this.project_id, resource, this.basePath)
          .should.equal(true)
      )
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('syncResourcesToDisk on an incremental update when the state does not match', function () {
    beforeEach(function () {
      this.resources = ['resource-1-mock']
      this.request = {
        project_id: this.project_id,
        syncType: 'incremental',
        syncState: (this.syncState = '1234567890abcdef'),
        resources: this.resources,
      }
      this.ResourceStateManager.checkProjectStateMatches = sinon
        .stub()
        .callsArgWith(2, (this.error = new Error()))
      return this.ResourceWriter.syncResourcesToDisk(
        this.request,
        this.basePath,
        this.callback
      )
    })

    it('should check whether the sync state matches', function () {
      return this.ResourceStateManager.checkProjectStateMatches
        .calledWith(this.syncState, this.basePath)
        .should.equal(true)
    })

    return it('should call the callback with an error', function () {
      return this.callback.calledWith(this.error).should.equal(true)
    })
  })

  describe('_removeExtraneousFiles', function () {
    beforeEach(function () {
      this.output_files = [
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
      this.resources = 'mock-resources'
      this.request = {
        project_id: this.project_id,
        syncType: 'incremental',
        syncState: (this.syncState = '1234567890abcdef'),
        resources: this.resources,
      }
      this.OutputFileFinder.findOutputFiles = sinon
        .stub()
        .callsArgWith(2, null, this.output_files)
      this.ResourceWriter._deleteFileIfNotDirectory = sinon.stub().callsArg(1)
      return this.ResourceWriter._removeExtraneousFiles(
        this.request,
        this.resources,
        this.basePath,
        this.callback
      )
    })

    it('should find the existing output files', function () {
      return this.OutputFileFinder.findOutputFiles
        .calledWith(this.resources, this.basePath)
        .should.equal(true)
    })

    it('should delete the output files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'output.pdf'))
        .should.equal(true)
    })

    it('should delete the stdout log file', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'output.stdout'))
        .should.equal(true)
    })

    it('should delete the stderr log file', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'output.stderr'))
        .should.equal(true)
    })

    it('should delete the extra files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'extra/file.tex'))
        .should.equal(true)
    })

    it('should not delete the extra aux files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'extra.aux'))
        .should.equal(false)
    })

    it('should not delete the knitr cache file', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'cache/_chunk1'))
        .should.equal(false)
    })

    it('should not delete the epstopdf converted files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(this.basePath, 'figures/image-eps-converted-to.pdf')
        )
        .should.equal(false)
    })

    it('should not delete the tikz md5 files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'foo/main-figure0.md5'))
        .should.equal(false)
    })

    it('should not delete the tikz dpth files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'foo/main-figure0.dpth'))
        .should.equal(false)
    })

    it('should not delete the tikz pdf files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, 'foo/main-figure0.pdf'))
        .should.equal(false)
    })

    it('should not delete the minted pygstyle files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(this.basePath, '_minted-main/default-pyg-prefix.pygstyle')
        )
        .should.equal(false)
    })

    it('should not delete the minted default pygstyle files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(path.join(this.basePath, '_minted-main/default.pygstyle'))
        .should.equal(false)
    })

    it('should not delete the minted default pygtex files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(
            this.basePath,
            '_minted-main/35E248B60965545BD232AE9F0FE9750D504A7AF0CD3BAA7542030FC560DFCC45.pygtex'
          )
        )
        .should.equal(false)
    })

    it('should not delete the markdown md.tex files', function () {
      return this.ResourceWriter._deleteFileIfNotDirectory
        .calledWith(
          path.join(
            this.basePath,
            '_markdown_main/30893013dec5d869a415610079774c2f.md.tex'
          )
        )
        .should.equal(false)
    })

    it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })

    return it('should time the request', function () {
      return this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('_writeResourceToDisk', function () {
    describe('with a url based resource', function () {
      beforeEach(function () {
        this.fs.mkdir = sinon.stub().callsArg(2)
        this.resource = {
          path: 'main.tex',
          url: 'http://www.example.com/primary/main.tex',
          fallbackURL: 'http://fallback.example.com/fallback/main.tex',
          modified: Date.now(),
        }
        this.UrlCache.downloadUrlToFile = sinon
          .stub()
          .callsArgWith(5, 'fake error downloading file')
        return this.ResourceWriter._writeResourceToDisk(
          this.project_id,
          this.resource,
          this.basePath,
          this.callback
        )
      })

      it('should ensure the directory exists', function () {
        this.fs.mkdir
          .calledWith(
            path.dirname(path.join(this.basePath, this.resource.path))
          )
          .should.equal(true)
      })

      it('should write the URL from the cache', function () {
        return this.UrlCache.downloadUrlToFile
          .calledWith(
            this.project_id,
            this.resource.url,
            this.resource.fallbackURL,
            path.join(this.basePath, this.resource.path),
            this.resource.modified
          )
          .should.equal(true)
      })

      it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })

      return it('should not return an error if the resource writer errored', function () {
        return expect(this.callback.args[0][0]).not.to.exist
      })
    })

    describe('with a content based resource', function () {
      beforeEach(function () {
        this.resource = {
          path: 'main.tex',
          content: 'Hello world',
        }
        this.fs.writeFile = sinon.stub().callsArg(2)
        this.fs.mkdir = sinon.stub().callsArg(2)
        return this.ResourceWriter._writeResourceToDisk(
          this.project_id,
          this.resource,
          this.basePath,
          this.callback
        )
      })

      it('should ensure the directory exists', function () {
        return this.fs.mkdir
          .calledWith(
            path.dirname(path.join(this.basePath, this.resource.path))
          )
          .should.equal(true)
      })

      it('should write the contents to disk', function () {
        return this.fs.writeFile
          .calledWith(
            path.join(this.basePath, this.resource.path),
            this.resource.content
          )
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    return describe('with a file path that breaks out of the root folder', function () {
      beforeEach(function () {
        this.resource = {
          path: '../../main.tex',
          content: 'Hello world',
        }
        this.fs.writeFile = sinon.stub().callsArg(2)
        return this.ResourceWriter._writeResourceToDisk(
          this.project_id,
          this.resource,
          this.basePath,
          this.callback
        )
      })

      it('should not write to disk', function () {
        return this.fs.writeFile.called.should.equal(false)
      })

      it('should return an error', function () {
        this.callback.calledWith(sinon.match(Error)).should.equal(true)

        const message = this.callback.args[0][0].message
        expect(message).to.include('resource path is outside root directory')
      })
    })
  })

  return describe('checkPath', function () {
    describe('with a valid path', function () {
      beforeEach(function () {
        return this.ResourceWriter.checkPath('foo', 'bar', this.callback)
      })

      return it('should return the joined path', function () {
        return this.callback.calledWith(null, 'foo/bar').should.equal(true)
      })
    })

    describe('with an invalid path', function () {
      beforeEach(function () {
        this.ResourceWriter.checkPath('foo', 'baz/../../bar', this.callback)
      })

      it('should return an error', function () {
        this.callback.calledWith(sinon.match(Error)).should.equal(true)

        const message = this.callback.args[0][0].message
        expect(message).to.include('resource path is outside root directory')
      })
    })

    describe('with another invalid path matching on a prefix', function () {
      beforeEach(function () {
        return this.ResourceWriter.checkPath(
          'foo',
          '../foobar/baz',
          this.callback
        )
      })

      it('should return an error', function () {
        this.callback.calledWith(sinon.match(Error)).should.equal(true)

        const message = this.callback.args[0][0].message
        expect(message).to.include('resource path is outside root directory')
      })
    })
  })
})
