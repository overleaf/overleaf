import _ from 'lodash'
import AlgoliaSearch from 'algoliasearch'
import getMeta from '../../utils/meta'

interface WikiHit {
  pageName: string
  sectionName?: string
  kb?: boolean
  _highlightResult: {
    pageName: {
      value: string
    }
    content: {
      value: string
    }
  }
}

export interface FormattedWikiHit {
  url: string
  pageName: string
  rawPageName: string
  sectionName?: string
  content: string
}

interface AlgoliaSearchResponse {
  hits: WikiHit[]
  nbHits: number
  nbPages: number
}

let wikiIdx: AlgoliaSearch.Index | undefined

export async function searchWiki(
  query: string,
  options?: AlgoliaSearch.QueryParameters
): Promise<AlgoliaSearchResponse> {
  if (!wikiIdx) {
    const algoliaConfig = getMeta('ol-algolia')
    const wikiIndex = _.get(algoliaConfig, 'indexes.wiki')
    if (wikiIndex && algoliaConfig) {
      const client = AlgoliaSearch(algoliaConfig.appId, algoliaConfig.apiKey)
      wikiIdx = client.initIndex(wikiIndex)
    }
  }
  if (!wikiIdx) {
    return { hits: [], nbHits: 0, nbPages: 0 }
  }
  return wikiIdx.search({ query, ...options }) as Promise<AlgoliaSearchResponse>
}

export function formatWikiHit(hit: WikiHit): FormattedWikiHit {
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
