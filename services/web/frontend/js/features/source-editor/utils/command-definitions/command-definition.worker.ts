import { CommandDefinition, findDefinition } from './command-definition'

export type CommandDefinitionWorkerRequest = {
  id: number
  type: 'find'
  name: string
  docs: { path: string; content: string }[]
}

export type CommandDefinitionWorkerResponse = {
  id: number
  type: 'definition'
  definition: CommandDefinition | null
}

self.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as CommandDefinitionWorkerRequest
  if (message.type !== 'find') {
    return
  }

  const response: CommandDefinitionWorkerResponse = {
    id: message.id,
    type: 'definition',
    definition: findDefinition(message.docs, message.name),
  }
  self.postMessage(response)
})
