/* eslint-disable no-template-curly-in-string */

const { expect } = require('chai')
const pug = require('pug')
const modulePath = '../../../../app/src/infrastructure/Views.js'
const SandboxedModule = require('sandboxed-module')

describe('Views', function () {
  beforeEach(function () {
    this.Views = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          viewIncludes: {
            someInclude: 'path/to/_include.pug',
          },
        }),
      },
    })
  })

  describe('_expectMetaFor', function () {
    const cases = [
      {
        name: 'no-js',
        filename: '500.pug',
        firstLine: 'extends ../layout/layout-no-js',
        expectMeta: false,
      },
      {
        name: 'doctype html',
        filename: 'user_info_not_found.pug',
        firstLine: 'doctype html',
        expectMeta: false,
      },
      {
        name: 'doctype xml',
        filename: 'feed.pug',
        firstLine: 'doctype xml',
        expectMeta: false,
      },
      {
        name: 'view include',
        filename: 'path/to/_include.pug',
        firstLine: '//- comment in include',
        expectMeta: false,
      },
      {
        name: 'view include',
        filename: 'ide-react.pug',
        firstLine: 'extends ../layout-react',
        expectMeta: true,
      },
    ]
    for (const { name, filename, firstLine, expectMeta } of cases) {
      it(name, function () {
        expect(this.Views._expectMetaFor(filename, firstLine)).to.equal(
          expectMeta
        )
      })
    }
  })

  describe('_findAllMetaTags', function () {
    const cases = [
      {
        name: 'simple quote',
        src: "meta(name='ol-foo' content=1)",
        found: ['ol-foo'],
        duplicates: [],
      },
      {
        name: 'double quote',
        src: 'meta(name="ol-foo" content=1)',
        found: ['ol-foo'],
        duplicates: [],
      },
      {
        name: 'code quote',
        src: 'meta(name=`ol-foo` content=1)',
        found: ['ol-foo'],
        duplicates: [],
      },
      {
        name: 'multiple',
        src: "meta(name='ol-foo' content=1)\nmeta(name='ol-bar' content=2)",
        found: ['ol-foo', 'ol-bar'],
        duplicates: [],
      },
      {
        name: 'computed single',
        src: "meta(name='ol-prefix-' + foo content=1)",
        found: ['ol-prefix-'],
        duplicates: [],
      },
      {
        name: 'computed double',
        src: 'meta(name="ol-prefix-" + foo content=1)',
        found: ['ol-prefix-'],
        duplicates: [],
      },
      {
        name: 'computed code',
        src: 'meta(name=`ol-prefix-${foo}` content=1)',
        found: ['ol-prefix-${foo}'],
        duplicates: [],
      },
      {
        name: 'duplicate',
        src: `meta(name='ol-foo' content=1)\nmeta(name="ol-foo")`,
        found: ['ol-foo'],
        duplicates: ['ol-foo'],
      },
      {
        name: 'compiled code',
        compiled: `pug_html = pug_html + "\u003Cmeta" + (" name=\\"ol-csrfToken\\""+pug.attr("content", csrfToken, true, true)) + "\u003E\u003Cmeta" + (" name=\\"ol-baseAssetPath\\""+pug.attr("content", buildBaseAssetPath(), true, true))`,
        found: ['ol-csrfToken', 'ol-baseAssetPath'],
        duplicates: [],
      },
    ]
    for (const { name, compiled, src, found, duplicates } of cases) {
      it(name, function () {
        const res = this.Views._findAllMetaTags(
          compiled || pug.compileClient(src, this.Views.PUG_COMPILE_ARGUMENTS)
        )
        expect(res).to.deep.equal({ found, duplicates })
      })
    }
  })
})
