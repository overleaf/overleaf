import type { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import { CommandDefinition, isIndexablePath } from './command-definition'
import type {
  CommandDefinitionWorkerRequest,
  CommandDefinitionWorkerResponse,
} from './command-definition.worker'

type SnapshotLike = Pick<ProjectSnapshot, 'getDocPaths' | 'getDocContents'>

/**
 * Locates the definition of a single command in the project by parsing the
 * snapshot in a worker, off the main thread, so opening the context menu is
 * never blocked. A single worker is reused across lookups so opening the menu
 * never spawns one.
 */
class CommandDefinitionIndexer {
  private worker: Worker
  private nextId = 0
  private resolvers = new Map<
    number,
    (definition: CommandDefinition | null) => void
  >()

  constructor() {
    this.worker = new Worker(
      /* webpackChunkName: "command-definition-worker" */
      new URL('./command-definition.worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.addEventListener('message', event => {
      const data = event.data as CommandDefinitionWorkerResponse
      if (data.type === 'definition') {
        this.resolvers.get(data.id)?.(data.definition)
        this.resolvers.delete(data.id)
      }
    })
  }

  findDefinition(
    snapshot: SnapshotLike,
    name: string
  ): Promise<CommandDefinition | null> {
    // Only send documents that mention the command (its defined name always
    // appears literally in its definition), to avoid cloning the whole project
    // to the worker.
    const docs: { path: string; content: string }[] = []
    for (const path of snapshot.getDocPaths()) {
      if (!isIndexablePath(path)) {
        continue
      }
      const content = snapshot.getDocContents(path)
      if (content != null && content.includes(name)) {
        docs.push({ path, content })
      }
    }

    const id = this.nextId++
    const request: CommandDefinitionWorkerRequest = {
      id,
      type: 'find',
      name,
      docs,
    }
    this.worker.postMessage(request)
    return new Promise(resolve => {
      this.resolvers.set(id, resolve)
    })
  }
}

let indexer: CommandDefinitionIndexer | undefined

export function getCommandDefinitionIndexer(): CommandDefinitionIndexer {
  if (!indexer) {
    indexer = new CommandDefinitionIndexer()
  }
  return indexer
}
