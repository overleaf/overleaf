import {
  ChangeSet,
  Extension,
  StateEffect,
  StateField,
} from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { addEffectListener, removeEffectListener } from './effect-listeners'
import { setMetadataEffect } from './language'
import { debugConsole } from '@/utils/debugging'
import {
  dispatchFigureModalPasteEvent,
  isAllowedImageType,
} from '../utils/paste-image'

type NestedReadonly<T> = {
  readonly [P in keyof T]: NestedReadonly<T[P]>
}

type FigureDataProps = {
  from: number
  to: number
  caption: {
    from: number
    to: number
  } | null
  label: { from: number; to: number } | null
  width?: number
  unknownGraphicsArguments?: string
  graphicsCommandArguments: {
    from: number
    to: number
  } | null
  graphicsCommand: { from: number; to: number }
  file: {
    from: number
    to: number
    path: string
  }
}

function mapFromTo<T extends { from: number; to: number } | null>(
  position: T,
  changes: ChangeSet
) {
  if (!position) {
    return position
  }
  return {
    ...position,
    from: changes.mapPos(position.from),
    to: changes.mapPos(position.to),
  }
}

export class FigureData {
  // eslint-disable-next-line no-useless-constructor
  constructor(private props: NestedReadonly<FigureDataProps>) {}

  public get from() {
    return this.props.from
  }

  public get to() {
    return this.props.to
  }

  public get caption() {
    return this.props.caption
  }

  public get label() {
    return this.props.label
  }

  public get width() {
    return this.props.width
  }

  public get unknownGraphicsArguments() {
    return this.props.unknownGraphicsArguments
  }

  public get graphicsCommandArguments() {
    return this.props.graphicsCommandArguments
  }

  public get graphicsCommand() {
    return this.props.graphicsCommand
  }

  public get file() {
    return this.props.file
  }

  map(changes: ChangeSet): FigureData {
    return new FigureData({
      from: changes.mapPos(this.from),
      to: changes.mapPos(this.to),
      caption: mapFromTo(this.caption, changes),
      label: mapFromTo(this.label, changes),
      graphicsCommand: mapFromTo(this.graphicsCommand, changes),
      width: this.width,
      file: mapFromTo(this.file, changes),
      graphicsCommandArguments: mapFromTo(
        this.graphicsCommandArguments,
        changes
      ),
      unknownGraphicsArguments: this.unknownGraphicsArguments,
    })
  }
}

export const editFigureDataEffect = StateEffect.define<FigureData | null>()

export const editFigureData = StateField.define<FigureData | null>({
  create: () => null,
  update: (current, transaction) => {
    let value: FigureData | null | undefined
    for (const effect of transaction.effects) {
      if (effect.is(editFigureDataEffect)) {
        value = effect.value
      }
    }
    // Allow setting to null
    if (value !== undefined) {
      return value
    }

    if (!current) {
      return current
    }
    return current.map(transaction.changes)
  },
})

export const figureModal = (): Extension => [editFigureData]

export function waitForFileTreeUpdate(view: EditorView) {
  const abortController = new AbortController()
  const promise = new Promise<void>(resolve => {
    const abort = () => {
      debugConsole.warn('Aborting wait for file tree update')
      removeEffectListener(view, setMetadataEffect, listener)
      resolve()
    }
    function listener() {
      if (abortController.signal.aborted) {
        // We've already handled this
        return
      }
      abortController.signal.removeEventListener('abort', abort)
      resolve()
    }
    abortController.signal.addEventListener('abort', abort, { once: true })
    addEffectListener(view, setMetadataEffect, listener, { once: true })
  })
  return {
    withTimeout(afterMs = 500) {
      setTimeout(() => abortController.abort(), afterMs)
      return promise
    },
    promise,
  }
}

export const figureModalPasteHandler = (): Extension => {
  return EditorView.domEventHandlers({
    drop: evt => {
      if (!evt.dataTransfer || evt.dataTransfer.files.length === 0) {
        return
      }
      const file = evt.dataTransfer.files[0]
      if (!isAllowedImageType(file.type)) {
        return
      }
      dispatchFigureModalPasteEvent({
        name: file.name,
        type: file.type,
        data: file,
      })
    },
    paste: evt => {
      if (!evt.clipboardData || evt.clipboardData.files.length === 0) {
        return
      }
      if (evt.clipboardData.types.includes('text/plain')) {
        return // allow pasted text to be handled even if there's also a file on the clipboard
      }
      const file = evt.clipboardData.files[0]
      if (!isAllowedImageType(file.type)) {
        return
      }
      dispatchFigureModalPasteEvent({
        name: file.name,
        type: file.type,
        data: file,
      })
    },
  })
}
