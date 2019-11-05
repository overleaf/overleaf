/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.factory('algoliaSearch', function() {
    let kbIdx, wikiIdx
    if (
      (window.sharelatex != null ? window.sharelatex.algolia : undefined) !=
        null &&
      __guard__(
        window.sharelatex.algolia != null
          ? window.sharelatex.algolia.indexes
          : undefined,
        x => x.wiki
      ) != null
    ) {
      const client = new AlgoliaSearch(
        window.sharelatex.algolia != null
          ? window.sharelatex.algolia.app_id
          : undefined,
        window.sharelatex.algolia != null
          ? window.sharelatex.algolia.api_key
          : undefined
      )
      wikiIdx = client.initIndex(
        __guard__(
          window.sharelatex.algolia != null
            ? window.sharelatex.algolia.indexes
            : undefined,
          x1 => x1.wiki
        )
      )
      kbIdx = client.initIndex(
        __guard__(
          window.sharelatex.algolia != null
            ? window.sharelatex.algolia.indexes
            : undefined,
          x2 => x2.kb
        )
      )
    }

    // searchKB is deprecated
    const service = {
      searchWiki: wikiIdx ? wikiIdx.search.bind(wikiIdx) : null,
      searchKB: kbIdx ? kbIdx.search.bind(kbIdx) : null
    }

    return service
  }))
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
