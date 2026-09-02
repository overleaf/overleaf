import { expect } from 'chai'
import { getMatchedHitSnippet } from '../../../frontend/js/util/matched-hit-snippet'

describe('getMatchedHitSnippet', function () {
  it('builds before/match/after for a simple match', function () {
    const text = 'alpha beta gamma delta'
    const snippet = getMatchedHitSnippet(text, 6, 4)

    expect(snippet).to.deep.equal({
      before: 'alpha ',
      match: 'beta',
      after: ' gamma delta',
    })
  })

  it('caps raw prefix/suffix size when surrounding text is very long', function () {
    const text = `${'a'.repeat(300)}needle${'b'.repeat(300)}`
    const snippet = getMatchedHitSnippet(text, 300, 6)

    expect(snippet.match).to.equal('needle')
    expect(snippet.before.length).to.equal(250)
    expect(snippet.after.length).to.equal(250)
  })
})
