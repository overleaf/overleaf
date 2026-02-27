export type ProjectFileData = {
  relativePath: string
  content: string
}

// Main thread -> Worker messages

export type InitRequest = {
  type: 'init'
  baseAssetPath: string
}

export type RunCodeRequest = {
  type: 'run-code'
  id: string
  code: string
  files: ProjectFileData[]
}

export type PyodideWorkerRequest = InitRequest | RunCodeRequest

// Worker -> Main thread lifecycle and streaming events

export type ListeningEvent = { type: 'listening' }
export type LoadedEvent = { type: 'loaded' }
export type LoadingFailedEvent = { type: 'loading-failed'; error: string }

export type OutputLineEvent = {
  type: 'output-line'
  stream: 'stdout' | 'stderr'
  line: string
  requestId?: string
}

export type PyodideWorkerEvent =
  | ListeningEvent
  | LoadedEvent
  | LoadingFailedEvent
  | OutputLineEvent

// Worker -> Main thread ID responses

export type RunCodeResult = {
  type: 'run-code-result'
  id: string
}

export type PyodideWorkerResponse = PyodideWorkerEvent | RunCodeResult
