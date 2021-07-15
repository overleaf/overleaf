/* eslint-disable
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/RequestParser'
)
const tk = require('timekeeper')

describe('RequestParser', function () {
  beforeEach(function () {
    tk.freeze()
    this.callback = sinon.stub()
    this.validResource = {
      path: 'main.tex',
      date: '12:00 01/02/03',
      content: 'Hello world',
    }
    this.validRequest = {
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
    return (this.RequestParser = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {}),
      },
    }))
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('without a top level object', function () {
    beforeEach(function () {
      return this.RequestParser.parse([], this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('top level object should have a compile attribute')
        .should.equal(true)
    })
  })

  describe('without a compile attribute', function () {
    beforeEach(function () {
      return this.RequestParser.parse({}, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('top level object should have a compile attribute')
        .should.equal(true)
    })
  })

  describe('without a valid compiler', function () {
    beforeEach(function () {
      this.validRequest.compile.options.compiler = 'not-a-compiler'
      return this.RequestParser.parse(this.validRequest, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith(
          'compiler attribute should be one of: pdflatex, latex, xelatex, lualatex'
        )
        .should.equal(true)
    })
  })

  describe('without a compiler specified', function () {
    beforeEach(function () {
      delete this.validRequest.compile.options.compiler
      return this.RequestParser.parse(this.validRequest, (error, data) => {
        this.data = data
      })
    })

    return it('should set the compiler to pdflatex by default', function () {
      return this.data.compiler.should.equal('pdflatex')
    })
  })

  describe('with imageName set', function () {
    beforeEach(function () {
      return this.RequestParser.parse(this.validRequest, (error, data) => {
        this.data = data
      })
    })

    return it('should set the imageName', function () {
      return this.data.imageName.should.equal('basicImageName/here:2017-1')
    })
  })

  describe('when image restrictions are present', function () {
    beforeEach(function () {
      this.settings.clsi = { docker: {} }
      this.settings.clsi.docker.allowedImages = [
        'repo/name:tag1',
        'repo/name:tag2',
      ]
    })

    describe('with imageName set to something invalid', function () {
      beforeEach(function () {
        const request = this.validRequest
        request.compile.options.imageName = 'something/different:latest'
        this.RequestParser.parse(request, (error, data) => {
          this.error = error
          this.data = data
        })
      })

      it('should throw an error for imageName', function () {
        expect(String(this.error)).to.include(
          'imageName attribute should be one of'
        )
      })
    })

    describe('with imageName set to something valid', function () {
      beforeEach(function () {
        const request = this.validRequest
        request.compile.options.imageName = 'repo/name:tag1'
        this.RequestParser.parse(request, (error, data) => {
          this.error = error
          this.data = data
        })
      })

      it('should set the imageName', function () {
        this.data.imageName.should.equal('repo/name:tag1')
      })
    })
  })

  describe('with flags set', function () {
    beforeEach(function () {
      this.validRequest.compile.options.flags = ['-file-line-error']
      return this.RequestParser.parse(this.validRequest, (error, data) => {
        this.data = data
      })
    })

    return it('should set the flags attribute', function () {
      return expect(this.data.flags).to.deep.equal(['-file-line-error'])
    })
  })

  describe('with flags not specified', function () {
    beforeEach(function () {
      return this.RequestParser.parse(this.validRequest, (error, data) => {
        this.data = data
      })
    })

    return it('it should have an empty flags list', function () {
      return expect(this.data.flags).to.deep.equal([])
    })
  })

  describe('without a timeout specified', function () {
    beforeEach(function () {
      delete this.validRequest.compile.options.timeout
      return this.RequestParser.parse(this.validRequest, (error, data) => {
        this.data = data
      })
    })

    return it('should set the timeout to MAX_TIMEOUT', function () {
      return this.data.timeout.should.equal(
        this.RequestParser.MAX_TIMEOUT * 1000
      )
    })
  })

  describe('with a timeout larger than the maximum', function () {
    beforeEach(function () {
      this.validRequest.compile.options.timeout =
        this.RequestParser.MAX_TIMEOUT + 1
      return this.RequestParser.parse(this.validRequest, (error, data) => {
        this.data = data
      })
    })

    return it('should set the timeout to MAX_TIMEOUT', function () {
      return this.data.timeout.should.equal(
        this.RequestParser.MAX_TIMEOUT * 1000
      )
    })
  })

  describe('with a timeout', function () {
    beforeEach(function () {
      return this.RequestParser.parse(this.validRequest, (error, data) => {
        this.data = data
      })
    })

    return it('should set the timeout (in milliseconds)', function () {
      return this.data.timeout.should.equal(
        this.validRequest.compile.options.timeout * 1000
      )
    })
  })

  describe('with a resource without a path', function () {
    beforeEach(function () {
      delete this.validResource.path
      this.validRequest.compile.resources.push(this.validResource)
      return this.RequestParser.parse(this.validRequest, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('all resources should have a path attribute')
        .should.equal(true)
    })
  })

  describe('with a resource with a path', function () {
    beforeEach(function () {
      this.validResource.path = this.path = 'test.tex'
      this.validRequest.compile.resources.push(this.validResource)
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return the path in the parsed response', function () {
      return this.data.resources[0].path.should.equal(this.path)
    })
  })

  describe('with a resource with a malformed modified date', function () {
    beforeEach(function () {
      this.validResource.modified = 'not-a-date'
      this.validRequest.compile.resources.push(this.validResource)
      return this.RequestParser.parse(this.validRequest, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith(
          'resource modified date could not be understood: ' +
            this.validResource.modified
        )
        .should.equal(true)
    })
  })

  describe('with a resource with a valid date', function () {
    beforeEach(function () {
      this.date = '12:00 01/02/03'
      this.validResource.modified = this.date
      this.validRequest.compile.resources.push(this.validResource)
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return the date as a Javascript Date object', function () {
      ;(this.data.resources[0].modified instanceof Date).should.equal(true)
      return this.data.resources[0].modified
        .getTime()
        .should.equal(Date.parse(this.date))
    })
  })

  describe('with a resource without either a content or URL attribute', function () {
    beforeEach(function () {
      delete this.validResource.url
      delete this.validResource.content
      this.validRequest.compile.resources.push(this.validResource)
      return this.RequestParser.parse(this.validRequest, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith(
          'all resources should have either a url or content attribute'
        )
        .should.equal(true)
    })
  })

  describe('with a resource where the content is not a string', function () {
    beforeEach(function () {
      this.validResource.content = []
      this.validRequest.compile.resources.push(this.validResource)
      return this.RequestParser.parse(this.validRequest, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('content attribute should be a string')
        .should.equal(true)
    })
  })

  describe('with a resource where the url is not a string', function () {
    beforeEach(function () {
      this.validResource.url = []
      this.validRequest.compile.resources.push(this.validResource)
      return this.RequestParser.parse(this.validRequest, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('url attribute should be a string')
        .should.equal(true)
    })
  })

  describe('with a resource with a url', function () {
    beforeEach(function () {
      this.validResource.url = this.url = 'www.example.com'
      this.validRequest.compile.resources.push(this.validResource)
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return the url in the parsed response', function () {
      return this.data.resources[0].url.should.equal(this.url)
    })
  })

  describe('with a resource with a content attribute', function () {
    beforeEach(function () {
      this.validResource.content = this.content = 'Hello world'
      this.validRequest.compile.resources.push(this.validResource)
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return the content in the parsed response', function () {
      return this.data.resources[0].content.should.equal(this.content)
    })
  })

  describe('without a root resource path', function () {
    beforeEach(function () {
      delete this.validRequest.compile.rootResourcePath
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it("should set the root resource path to 'main.tex' by default", function () {
      return this.data.rootResourcePath.should.equal('main.tex')
    })
  })

  describe('with a root resource path', function () {
    beforeEach(function () {
      this.validRequest.compile.rootResourcePath = this.path = 'test.tex'
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return the root resource path in the parsed response', function () {
      return this.data.rootResourcePath.should.equal(this.path)
    })
  })

  describe('with a root resource path that is not a string', function () {
    beforeEach(function () {
      this.validRequest.compile.rootResourcePath = []
      return this.RequestParser.parse(this.validRequest, this.callback)
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('rootResourcePath attribute should be a string')
        .should.equal(true)
    })
  })

  describe('with a root resource path that needs escaping', function () {
    beforeEach(function () {
      this.badPath = '`rm -rf foo`.tex'
      this.goodPath = 'rm -rf foo.tex'
      this.validRequest.compile.rootResourcePath = this.badPath
      this.validRequest.compile.resources.push({
        path: this.badPath,
        date: '12:00 01/02/03',
        content: 'Hello world',
      })
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    it('should return the escaped resource', function () {
      return this.data.rootResourcePath.should.equal(this.goodPath)
    })

    return it('should also escape the resource path', function () {
      return this.data.resources[0].path.should.equal(this.goodPath)
    })
  })

  describe('with a root resource path that has a relative path', function () {
    beforeEach(function () {
      this.validRequest.compile.rootResourcePath = 'foo/../../bar.tex'
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('relative path in root resource')
        .should.equal(true)
    })
  })

  describe('with a root resource path that has unescaped + relative path', function () {
    beforeEach(function () {
      this.validRequest.compile.rootResourcePath = 'foo/#../bar.tex'
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('relative path in root resource')
        .should.equal(true)
    })
  })

  return describe('with an unknown syncType', function () {
    beforeEach(function () {
      this.validRequest.compile.options.syncType = 'unexpected'
      this.RequestParser.parse(this.validRequest, this.callback)
      return (this.data = this.callback.args[0][1])
    })

    return it('should return an error', function () {
      return this.callback
        .calledWith('syncType attribute should be one of: full, incremental')
        .should.equal(true)
    })
  })
})
