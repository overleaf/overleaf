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

export function formatWikiHit(hit) {
  const pageUnderscored = hit.pageName.replace(/\s/g, '_')
  const pageSlug = encodeURIComponent(pageUnderscored)
  const pagePath = hit.kb ? 'how-to' : 'latex'

  let pageAnchor = ''
  const rawPageName = hit._highlightResult.pageName.value
  const sectionName = hit.sectionName
  let pageName = rawPageName
  if (sectionName) {
    pageAnchor = `#${sectionName.replace(/\s/g, '_')}`
    pageName += ' - ' + sectionName
  }

  const body = hit._highlightResult.content.value
  const content = body
    .split('\n')
    .filter(line => line.includes('<em>') && !line.includes('[edit]'))
    .join('\n...\n')

  const url = `/learn/${pagePath}/${pageSlug}${pageAnchor}`
  return { url, pageName, rawPageName, sectionName, content }
}
