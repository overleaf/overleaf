import { v4 as uuid } from 'uuid'
import getMeta from '@/utils/meta'
import { debugConsole } from '@/utils/debugging'

type Message =
  | {
      id?: string
      type: 'spell'
      words: string[]
    }
  | {
      id?: string
      type: 'suggest'
      word: string
    }
  | {
      id?: string
      type: 'add_word'
      word: string
    }
  | {
      id?: string
      type: 'remove_word'
      word: string
    }
  | {
      id?: string
      type: 'destroy'
    }

export class HunspellManager {
  baseAssetPath: string
  dictionariesRoot: string
  hunspellWorker!: Worker
  abortController: AbortController | undefined
  listening = false
  loaded = false
  pendingMessages: Message[] = []
  callbacks: Map<string, (value: unknown) => void> = new Map()

  constructor(
    private readonly language: string,
    private readonly learnedWords: string[]
  ) {
    this.baseAssetPath = new URL(
      getMeta('ol-baseAssetPath'),
      window.location.href
    ).toString()

    this.dictionariesRoot = getMeta('ol-dictionariesRoot')

    this.hunspellWorker = new Worker(
      /* webpackChunkName: "hunspell-worker" */
      new URL('./hunspell.worker.ts', import.meta.url),
      { type: 'module' }
    )

    this.hunspellWorker.addEventListener('message', this.receive.bind(this))
  }

  destroy() {
    this.send({ type: 'destroy' }, () => {
      this.hunspellWorker.terminate()
    })
  }

  send(message: Message, callback: (value: unknown) => void) {
    debugConsole.log(message)
    if (callback) {
      message.id = uuid()
      this.callbacks.set(message.id, callback)
    }

    if (this.listening) {
      this.hunspellWorker.postMessage(message)
    } else {
      this.pendingMessages.push(message)
    }
  }

  receive(event: MessageEvent) {
    debugConsole.log(event.data)
    const { id, listening, loaded, ...rest } = event.data
    if (id) {
      const callback = this.callbacks.get(id)
      if (callback) {
        this.callbacks.delete(id)
        callback(rest)
      }
    } else if (listening) {
      this.listening = true
      this.hunspellWorker.postMessage({
        type: 'init',
        lang: this.language,
        learnedWords: this.learnedWords, // TODO: add words
        baseAssetPath: this.baseAssetPath,
        dictionariesRoot: this.dictionariesRoot,
      })
      for (const message of this.pendingMessages) {
        this.hunspellWorker.postMessage(message)
        this.pendingMessages.length = 0
      }
    } else if (loaded) {
      this.loaded = true
      // TODO: use this to display pending state?
    }
  }
}
