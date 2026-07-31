const path = require('node:path')
const { expect } = require('chai')

const MODULE_PATH = path.join(__dirname, '../../serializers.js')
const serializers = require(MODULE_PATH)

// Mirrors the symbols the patched express (.yarn/patches/express-npm-*.patch)
// installs on req in REQ_LOCKDOWN_MODE=warn|throw, and how
// @overleaf/validation-tools' getRawReqInput() reads them.
const RAW_BODY = Symbol.for('overleaf.lockdown.rawBody')
const RAW_QUERY = Symbol.for('overleaf.lockdown.rawQuery')
const RAW_PARAMS = Symbol.for('overleaf.lockdown.rawParams')
const INSTALLED = Symbol.for('overleaf.lockdown.installed')

// Replicates what the patched express does to a request in throw mode:
// parsed input lives in symbol-keyed fields, the public `params` getter
// throws instead of returning it.
function lockedRequest({ params, ...rest }) {
  const req = { ...rest }
  req[INSTALLED] = true
  req[RAW_PARAMS] = params
  req[RAW_QUERY] = {}
  req[RAW_BODY] = undefined
  Object.defineProperty(req, 'params', {
    configurable: true,
    enumerable: false,
    get() {
      throw new Error('raw request input is forbidden (req.params)')
    },
  })
  return req
}

describe('reqSerializer', function () {
  it('returns undefined/falsy req untouched', function () {
    expect(serializers.req(null)).to.equal(null)
    expect(serializers.req(undefined)).to.equal(undefined)
  })

  it('extracts method, url, headers and remote address', function () {
    const req = {
      method: 'GET',
      originalUrl: '/project/123',
      headers: {
        referer: 'https://example.com',
        'user-agent': 'test-agent',
        'content-length': '42',
      },
      ip: '127.0.0.1',
      params: {},
    }

    expect(serializers.req(req)).to.deep.equal({
      method: 'GET',
      url: '/project/123',
      remoteAddress: '127.0.0.1',
      headers: {
        referer: 'https://example.com',
        'user-agent': 'test-agent',
        'content-length': '42',
      },
    })
  })

  it('extracts projectId/userId/docId from ordinary, readable req.params', function () {
    const req = {
      method: 'GET',
      url: '/',
      headers: {},
      params: {
        project_id: 'project-1',
        user_id: 'user-1',
        doc_id: 'doc-1',
      },
    }

    const entry = serializers.req(req)
    expect(entry.projectId).to.equal('project-1')
    expect(entry.userId).to.equal('user-1')
    expect(entry.docId).to.equal('doc-1')
  })

  it('prefers the camelCase param name when both spellings are present', function () {
    const req = {
      method: 'GET',
      url: '/',
      headers: {},
      params: {
        projectId: 'camel-project',
        project_id: 'snake-project',
        userId: 'camel-user',
        user_id: 'snake-user',
        docId: 'camel-doc',
        doc_id: 'snake-doc',
      },
    }

    const entry = serializers.req(req)
    expect(entry.projectId).to.equal('camel-project')
    expect(entry.userId).to.equal('camel-user')
    expect(entry.docId).to.equal('camel-doc')
  })

  it('omits projectId/userId/docId when req.params has none of the recognised fields', function () {
    const req = { method: 'GET', url: '/', headers: {}, params: {} }
    const entry = serializers.req(req)
    expect(entry).to.not.have.property('projectId')
    expect(entry).to.not.have.property('userId')
    expect(entry).to.not.have.property('docId')
  })

  it('does not throw when req.params is a lockdown-installed throwing getter, and still extracts the ids via the raw accessor', function () {
    const req = lockedRequest({
      method: 'GET',
      url: '/project/123',
      headers: {},
      params: {
        project_id: 'project-1',
        user_id: 'user-1',
        doc_id: 'doc-1',
      },
    })

    // Sanity check: touching req.params directly really does throw, the way
    // it would under REQ_LOCKDOWN_MODE=throw.
    expect(() => req.params).to.throw(/raw request input is forbidden/)

    let entry
    expect(() => {
      entry = serializers.req(req)
    }).to.not.throw()

    expect(entry.projectId).to.equal('project-1')
    expect(entry.userId).to.equal('user-1')
    expect(entry.docId).to.equal('doc-1')
  })
})
