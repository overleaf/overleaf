import _ from 'lodash'
import AlgoliaSearch from 'algoliasearch'
import getMeta from '../../utils/meta'

let wikiIdx
export async function searchWiki(...args) {
  if (!wikiIdx) {
    const algoliaConfig = getMeta('ol-algolia')
    const wikiIndex = _.get(algoliaConfig, 'indexes.wiki')
    if (wikiIndex) {
      const client = AlgoliaSearch(algoliaConfig.appId, algoliaConfig.apiKey)
      wikiIdx = client.initIndex(wikiIndex)
    }
  }
  if (!wikiIdx) {
    return { hits: [], nbHits: 0, nbPages: 0 }
  }
  return wikiIdx.search(...args)
}
