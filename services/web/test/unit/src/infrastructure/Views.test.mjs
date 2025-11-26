import { vi, expect } from 'vitest'

import pug from 'pug'
const modulePath = '../../../../app/src/infrastructure/Views.mjs'

describe('Views', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        viewIncludes: {
          someInclude: 'path/to/_include.pug',
        },
      }),
    }))

    ctx.Views = (await import(modulePath)).default
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
      it(name, function (ctx) {
        expect(ctx.Views._expectMetaFor(filename, firstLine)).to.equal(
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
        // eslint-disable-next-line no-template-curly-in-string
        src: 'meta(name=`ol-prefix-${foo}` content=1)',
        // eslint-disable-next-line no-template-curly-in-string
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
      it(name, function (ctx) {
        const res = ctx.Views._findAllMetaTags(
          compiled || pug.compileClient(src, ctx.Views.PUG_COMPILE_ARGUMENTS)
        )
        expect(res).to.deep.equal({ found, duplicates })
      })
    }
  })
})
