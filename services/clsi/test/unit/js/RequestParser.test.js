import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'
import sinon from 'sinon'
import tk from 'timekeeper'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/RequestParser'
)

describe('RequestParser', () => {
  beforeEach(async ctx => {
    tk.freeze()
    ctx.callback = sinon.stub()
    ctx.validResource = {
      path: 'main.tex',
      date: '12:00 01/02/03',
      content: 'Hello world',
    }
    ctx.validRequest = {
      compile: {
        token: 'token-123',
        options: {
          imageName: 'basicImageName/here:2017-1',
          compiler: 'pdflatex',
          timeout: 42,
        },
        resources: [],
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock('../../../app/js/OutputCacheManager', () => ({
      default: { BUILD_REGEX: /^[0-9a-f]+-[0-9a-f]+$/ },
    }))

    ctx.RequestParser = (await import(modulePath)).default
  })

  afterEach(() => {
    tk.reset()
  })

  describe('without a top level object', () => {
    beforeEach(ctx => {
      ctx.RequestParser.parse([], ctx.callback)
    })

    it('should return an error', ctx => {
      expect(ctx.callback).to.have.been.called
      expect(ctx.callback.args[0][0].message).to.equal(
        'top level object should have a compile attribute'
      )
    })
  })

  describe('without a compile attribute', () => {
    beforeEach(ctx => {
      ctx.RequestParser.parse({}, ctx.callback)
    })

    it('should return an error', ctx => {
      expect(ctx.callback).to.have.been.called
      expect(ctx.callback.args[0][0].message).to.equal(
        'top level object should have a compile attribute'
      )
    })
  })

  describe('without a valid compiler', () => {
    beforeEach(ctx => {
      ctx.validRequest.compile.options.compiler = 'not-a-compiler'
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({
          message:
            'compiler attribute should be one of: pdflatex, latex, xelatex, lualatex',
        })
        .should.equal(true)
    })
  })

  describe('without a compiler specified', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        delete ctx.validRequest.compile.options.compiler
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('should set the compiler to pdflatex by default', ctx => {
      ctx.data.compiler.should.equal('pdflatex')
    })
  })

  describe('with imageName set', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('should set the imageName', ctx => {
      ctx.data.imageName.should.equal('basicImageName/here:2017-1')
    })
  })

  describe('when image restrictions are present', () => {
    beforeEach(ctx => {
      ctx.settings.clsi = { docker: {} }
      ctx.settings.clsi.docker.allowedImages = [
        'repo/name:tag1',
        'repo/name:tag2',
      ]
    })

    describe('with imageName set to something invalid', () => {
      beforeEach(ctx => {
        const request = ctx.validRequest
        request.compile.options.imageName = 'something/different:latest'
        ctx.RequestParser.parse(request, (error, data) => {
          ctx.error = error
          ctx.data = data
        })
      })

      it('should throw an error for imageName', ctx => {
        expect(String(ctx.error)).to.include(
          'imageName attribute should be one of'
        )
      })
    })

    describe('with imageName set to something valid', () => {
      beforeEach(ctx => {
        const request = ctx.validRequest
        request.compile.options.imageName = 'repo/name:tag1'
        ctx.RequestParser.parse(request, (error, data) => {
          ctx.error = error
          ctx.data = data
        })
      })

      it('should set the imageName', ctx => {
        ctx.data.imageName.should.equal('repo/name:tag1')
      })
    })
  })

  describe('with flags set', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        ctx.validRequest.compile.options.flags = ['-file-line-error']
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('should set the flags attribute', ctx => {
      expect(ctx.data.flags).to.deep.equal(['-file-line-error'])
    })
  })

  describe('with flags not specified', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('it should have an empty flags list', ctx => {
      expect(ctx.data.flags).to.deep.equal([])
    })
  })

  describe('without a timeout specified', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        delete ctx.validRequest.compile.options.timeout
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('should set the timeout to MAX_TIMEOUT', ctx => {
      ctx.data.timeout.should.equal(ctx.RequestParser.MAX_TIMEOUT * 1000)
    })
  })

  describe('with a timeout larger than the maximum', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        ctx.validRequest.compile.options.timeout =
          ctx.RequestParser.MAX_TIMEOUT + 1
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('should set the timeout to MAX_TIMEOUT', ctx => {
      ctx.data.timeout.should.equal(ctx.RequestParser.MAX_TIMEOUT * 1000)
    })
  })

  describe('with a timeout', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('should set the timeout (in milliseconds)', ctx => {
      ctx.data.timeout.should.equal(
        ctx.validRequest.compile.options.timeout * 1000
      )
    })
  })

  describe('with a resource without a path', () => {
    beforeEach(ctx => {
      delete ctx.validResource.path
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({
          message: 'all resources should have a path attribute',
        })
        .should.equal(true)
    })
  })

  describe('with a resource with a path', () => {
    beforeEach(ctx => {
      ctx.validResource.path = ctx.path = 'test.tex'
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return the path in the parsed response', ctx => {
      ctx.data.resources[0].path.should.equal(ctx.path)
    })
  })

  describe('with a resource with a malformed modified date', () => {
    beforeEach(ctx => {
      ctx.validResource.modified = 'not-a-date'
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({
          message:
            'resource modified date could not be understood: ' +
            ctx.validResource.modified,
        })
        .should.equal(true)
    })
  })

  describe('with a valid buildId', () => {
    beforeEach(async ctx => {
      await new Promise((resolve, reject) => {
        ctx.validRequest.compile.options.buildId =
          '195a4869176-a4ad60bee7bf35e4'
        ctx.RequestParser.parse(ctx.validRequest, (error, data) => {
          if (error) return reject(error)
          ctx.data = data
          resolve()
        })
      })
    })

    it('should return an error', ctx => {
      ctx.data.buildId.should.equal('195a4869176-a4ad60bee7bf35e4')
    })
  })

  describe('with a bad buildId', () => {
    beforeEach(ctx => {
      ctx.validRequest.compile.options.buildId = 'foo/bar'
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({
          message:
            'buildId attribute does not match regex /^[0-9a-f]+-[0-9a-f]+$/',
        })
        .should.equal(true)
    })
  })

  describe('with a resource with a valid date', () => {
    beforeEach(ctx => {
      ctx.date = '12:00 01/02/03'
      ctx.validResource.modified = ctx.date
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return the date as a Javascript Date object', ctx => {
      ;(ctx.data.resources[0].modified instanceof Date).should.equal(true)
      ctx.data.resources[0].modified
        .getTime()
        .should.equal(Date.parse(ctx.date))
    })
  })

  describe('with a resource without either a content or URL attribute', () => {
    beforeEach(ctx => {
      delete ctx.validResource.url
      delete ctx.validResource.content
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({
          message:
            'all resources should have either a url or content attribute',
        })
        .should.equal(true)
    })
  })

  describe('with a resource where the content is not a string', () => {
    beforeEach(ctx => {
      ctx.validResource.content = []
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({ message: 'content attribute should be a string' })
        .should.equal(true)
    })
  })

  describe('with a resource where the url is not a string', () => {
    beforeEach(ctx => {
      ctx.validResource.url = []
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({ message: 'url attribute should be a string' })
        .should.equal(true)
    })
  })

  describe('with a resource with a url', () => {
    beforeEach(ctx => {
      ctx.validResource.url = ctx.url = 'www.example.com'
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return the url in the parsed response', ctx => {
      ctx.data.resources[0].url.should.equal(ctx.url)
    })
  })

  describe('with a resource with a content attribute', () => {
    beforeEach(ctx => {
      ctx.validResource.content = ctx.content = 'Hello world'
      ctx.validRequest.compile.resources.push(ctx.validResource)
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return the content in the parsed response', ctx => {
      ctx.data.resources[0].content.should.equal(ctx.content)
    })
  })

  describe('without a root resource path', () => {
    beforeEach(ctx => {
      delete ctx.validRequest.compile.rootResourcePath
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it("should set the root resource path to 'main.tex' by default", ctx => {
      ctx.data.rootResourcePath.should.equal('main.tex')
    })
  })

  describe('with a root resource path', () => {
    beforeEach(ctx => {
      ctx.validRequest.compile.rootResourcePath = ctx.path = 'test.tex'
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return the root resource path in the parsed response', ctx => {
      ctx.data.rootResourcePath.should.equal(ctx.path)
    })
  })

  describe('with a root resource path that is not a string', () => {
    beforeEach(ctx => {
      ctx.validRequest.compile.rootResourcePath = []
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({
          message: 'rootResourcePath attribute should be a string',
        })
        .should.equal(true)
    })
  })

  describe('with a root resource path that has a relative path', () => {
    beforeEach(ctx => {
      ctx.validRequest.compile.rootResourcePath = 'foo/../../bar.tex'
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({ message: 'relative path in root resource' })
        .should.equal(true)
    })
  })

  describe('with a root resource path that has unescaped + relative path', () => {
    beforeEach(ctx => {
      ctx.validRequest.compile.rootResourcePath = 'foo/../bar.tex'
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({ message: 'relative path in root resource' })
        .should.equal(true)
    })
  })

  describe('with an unknown syncType', () => {
    beforeEach(ctx => {
      ctx.validRequest.compile.options.syncType = 'unexpected'
      ctx.RequestParser.parse(ctx.validRequest, ctx.callback)
      ctx.data = ctx.callback.args[0][1]
    })

    it('should return an error', ctx => {
      ctx.callback
        .calledWithMatch({
          message: 'syncType attribute should be one of: full, incremental',
        })
        .should.equal(true)
    })
  })
})
