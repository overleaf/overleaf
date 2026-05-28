import { assert } from 'vitest'
import RequestHelper from '../../../../app/src/Features/Analytics/RequestHelper.mjs'

describe('RequestHelper', function () {
  describe('parseUtm', function () {
    it('returns null when query has no UTM keys', function () {
      assert.isNull(RequestHelper.parseUtm({ foo: 'bar' }))
    })

    it('returns null for empty query', function () {
      assert.isNull(RequestHelper.parseUtm({}))
    })

    it('extracts a single UTM key', function () {
      assert.deepEqual(
        RequestHelper.parseUtm({ utm_source: 'google', other: 'ignored' }),
        { utm_source: 'google' }
      )
    })

    it('extracts all UTM keys', function () {
      const query = {
        utm_campaign: 'camp',
        utm_source: 'src',
        utm_term: 'term',
        utm_content: 'cont',
        utm_medium: 'med',
        utm_count: '1',
        utm_id: 'id1',
      }
      assert.deepEqual(RequestHelper.parseUtm(query), query)
    })

    it('ignores falsy UTM values', function () {
      assert.isNull(RequestHelper.parseUtm({ utm_source: '' }))
    })
  })

  describe('parseReferrer', function () {
    const pageUrl = 'https://www.overleaf.com/project'

    describe('with no referrer', function () {
      it('returns direct medium', function () {
        assert.deepEqual(RequestHelper.parseReferrer(null, pageUrl), {
          medium: 'direct',
        })
      })

      it('returns direct medium for undefined', function () {
        assert.deepEqual(RequestHelper.parseReferrer(undefined, pageUrl), {
          medium: 'direct',
        })
      })
    })

    describe('with a search engine referrer', function () {
      it('returns search medium and source', function () {
        const result = RequestHelper.parseReferrer(
          'https://www.google.com/search?q=overleaf',
          pageUrl
        )
        assert.equal(result.medium, 'search')
        assert.equal(result.source, 'Google')
      })
    })

    describe('with an internal referrer (same site)', function () {
      it('returns internal medium', function () {
        const result = RequestHelper.parseReferrer(
          'https://www.overleaf.com/login',
          pageUrl
        )
        assert.equal(result.medium, 'internal')
      })
    })

    describe('with an unknown external referrer', function () {
      it('returns link medium with hostname as source', function () {
        const result = RequestHelper.parseReferrer(
          'https://some.example.com/article',
          pageUrl
        )
        assert.equal(result.medium, 'link')
        assert.equal(result.source, 'some.example.com')
      })
    })
  })
})
