/* eslint-disable no-dupe-class-members */

import { v4 as uuid } from 'uuid'
import getMeta from '@/utils/meta'
import { debugConsole } from '@/utils/debugging'
import { captureException } from '@/infrastructure/error-reporter'

type SpellMessage = {
  type: 'spell'
  words: string[]
}

type SuggestMessage = {
  type: 'suggest'
  word: string
}

type AddWordMessage = {
  type: 'add_word'
  word: string
}

type RemoveWordMessage = {
  type: 'remove_word'
  word: string
}

type DestroyMessage = {
  type: 'destroy'
}

type Message = { id?: string } & (
  | SpellMessage
  | SuggestMessage
  | AddWordMessage
  | RemoveWordMessage
  | DestroyMessage
)

type EmptyResult = Record<string, never>

type ErrorResult = {
  error: true
}

type SpellResult = {
  misspellings: { index: number }[]
}

type SuggestResult = {
  suggestions: string[]
}

type ResultCallback =
  | ((value: SpellResult | ErrorResult) => void)
  | ((value: SuggestResult | ErrorResult) => void)
  | ((value: EmptyResult | ErrorResult) => void)

export class HunspellManager {
  baseAssetPath: string
  dictionariesRoot: string
  hunspellWorker!: Worker
  abortController: AbortController | undefined
  listening = false
  loaded = false
  loadingFailed = false
  pendingMessages: Message[] = []
  callbacks: Map<string, ResultCallback> = new Map()

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

  send(
    message: AddWordMessage,
    callback: (value: EmptyResult | ErrorResult) => void
  ): void

  send(
    message: RemoveWordMessage,
    callback: (value: EmptyResult | ErrorResult) => void
  ): void

  send(
    message: DestroyMessage,
    callback: (value: EmptyResult | ErrorResult) => void
  ): void

  send(
    message: SuggestMessage,
    callback: (value: SuggestResult | ErrorResult) => void
  ): void

  send(
    message: SpellMessage,
    callback: (value: SpellResult | ErrorResult) => void
  ): void

  send(message: Message, callback: ResultCallback): void {
    if (this.loadingFailed) {
      return // ignore the message
    }

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
    const { id, ...rest } = event.data
    if (id) {
      const callback = this.callbacks.get(id)
      if (callback) {
        this.callbacks.delete(id)
        callback(rest)
      }
    } else if (rest.listening) {
      this.listening = true
      this.hunspellWorker.postMessage({
        type: 'init',
        lang: this.language,
        learnedWords: this.learnedWords,
        baseAssetPath: this.baseAssetPath,
        dictionariesRoot: this.dictionariesRoot,
      })
      for (const message of this.pendingMessages) {
        this.hunspellWorker.postMessage(message)
        this.pendingMessages.length = 0
      }
    } else if (rest.loaded) {
      this.loaded = true
    } else if (rest.loadingFailed) {
      captureException(
        new Error('Spell check loading failed', {
          cause: rest.loadingFailed,
        }),
        {
          tags: { ol_spell_check_language: this.language },
        }
      )
      this.loadingFailed = true
      this.pendingMessages.length = 0
    }
  }
}
