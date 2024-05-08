import { EditorView } from '@codemirror/view'
import { hasImageExtension } from '@/features/source-editor/utils/file'
import { FigureModalSource } from '@/features/source-editor/components/figure-modal/figure-modal-context'
import { EditorSelection } from '@codemirror/state'

export const fileTreeItemDrop = () =>
  EditorView.domEventHandlers({
    dragover(event) {
      // TODO: detect a drag from the file tree?
      if (event.dataTransfer) {
        event.preventDefault()
      }
    },
    drop(event, view) {
      if (event.dataTransfer) {
        const fileId = event.dataTransfer.getData(
          'application/x-overleaf-file-id'
        )

        const filePath = event.dataTransfer.getData(
          'application/x-overleaf-file-path'
        )

        if (fileId && filePath) {
          event.preventDefault()

          const pos = view.posAtCoords(event)
          if (pos !== null) {
            handleDroppedFile(view, pos, fileId, filePath)
          }
        }
      }
    },
  })

const withoutExtension = (filename: string) =>
  filename.substring(0, filename.lastIndexOf('.'))

const handleDroppedFile = (
  view: EditorView,
  pos: number,
  fileId: string,
  filePath: string
) => {
  if (filePath.endsWith('.bib')) {
    view.focus()

    const insert = `\\bibliography{${withoutExtension(filePath)}}`
    view.dispatch({
      changes: { from: pos, insert },
      selection: EditorSelection.cursor(pos + insert.length),
    })

    return
  }

  if (filePath.endsWith('.tex')) {
    view.focus()

    const insert = `\\input{${withoutExtension(filePath)}}`
    view.dispatch({
      changes: { from: pos, insert },
      selection: EditorSelection.cursor(pos + insert.length),
    })

    return
  }

  if (hasImageExtension(filePath)) {
    view.focus()

    view.dispatch({
      selection: EditorSelection.cursor(pos),
    })

    window.dispatchEvent(
      new CustomEvent('figure-modal:open', {
        detail: {
          source: FigureModalSource.FILE_TREE,
          fileId,
          filePath,
        },
      })
    )
    return
  }

  return null
}
