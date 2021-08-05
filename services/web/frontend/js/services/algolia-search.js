import _ from 'lodash'
import App from '../base'
import AlgoliaSearch from 'algoliasearch'
import getMeta from '../utils/meta'

export default App.factory('algoliaSearch', function () {
  let wikiIdx
  const algoliaConfig = getMeta('ol-algolia')
  const wikiIndex = _.get(algoliaConfig, 'indexes.wiki')
  if (wikiIndex) {
    const client = AlgoliaSearch(algoliaConfig.appId, algoliaConfig.apiKey)
    wikiIdx = client.initIndex(wikiIndex)
  }

  const service = {
    searchWiki: wikiIdx ? wikiIdx.search.bind(wikiIdx) : null,
  }

  return service
})
