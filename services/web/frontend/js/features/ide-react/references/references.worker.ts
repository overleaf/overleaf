import BasicReferenceIndex from './basic-reference-index'
import { ReferenceIndex } from './reference-index'
import { AdvancedReferenceSearchResult, Changes } from './types'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'

interface IndexConstructor {
  new (): ReferenceIndex
}

const indices = importOverleafModules('referenceIndices') as {
  import: { default: IndexConstructor }
  path: string
}[]

export type ReferenceWorkerRequest =
  | { type: 'update'; changes: Changes }
  | { type: 'search'; query: string }

export type ReferenceWorkerResponse =
  | { type: 'updateKeys'; keys: Set<string> }
  | { type: 'searchResult'; result: AdvancedReferenceSearchResult }

function createIndex(): ReferenceIndex {
  const Klass = indices[0]?.import.default ?? BasicReferenceIndex
  return new Klass()
}

const indexer: ReferenceIndex = createIndex()

self.addEventListener('message', async (event: MessageEvent) => {
  const message = event.data as ReferenceWorkerRequest
  switch (message.type) {
    case 'update':
      indexer.updateIndex(message.changes)
      self.postMessage({ type: 'updateKeys', keys: indexer.getKeys() })
      break

    case 'search': {
      const result = await indexer.search(message.query)
      self.postMessage({ type: 'searchResult', result })
      break
    }

    default:
      console.error('Unknown message type:', message)
  }
})
