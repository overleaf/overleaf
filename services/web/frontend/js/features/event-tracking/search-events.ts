import { sendMB } from '@/infrastructure/event-tracking'

type SearchEventSegmentation = {
  'search-open':
    | ({
        searchType: 'full-project'
      } & ({ method: 'keyboard' } | { method: 'button'; location: 'toolbar' }))
    | ({
        searchType: 'document'
        mode: 'visual' | 'source'
      } & ({ method: 'keyboard' } | { method: 'button'; location: 'toolbar' }))

  'search-execute': {
    searchType: 'full-project'
    totalDocs: number
    totalResults: number
  }
  'search-result-click': {
    searchType: 'full-project'
  }
  'search-replace-click': {
    searchType: 'document'
    method: 'keyboard' | 'button'
    action: 'replace' | 'replace-all'
  }
}

export const sendSearchEvent = <T extends keyof SearchEventSegmentation>(
  eventName: T,
  segmentation: SearchEventSegmentation[T]
) => {
  sendMB(eventName, segmentation)
}
