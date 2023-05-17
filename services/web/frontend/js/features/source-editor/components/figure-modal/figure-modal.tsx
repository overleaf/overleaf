import { Modal } from 'react-bootstrap'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import {
  FigureModalProvider,
  FigureModalSource,
  useFigureModalContext,
  useFigureModalExistingFigureContext,
} from './figure-modal-context'
import { FigureModalBody } from './figure-modal-body'
import { FigureModalFooter } from './figure-modal-footer'
import { memo, useCallback, useEffect } from 'react'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import { ChangeSpec } from '@codemirror/state'
import SplitTestBadge from '../../../../shared/components/split-test-badge'
import {
  FigureData,
  editFigureData,
  editFigureDataEffect,
} from '../../extensions/figure-modal'
import { ensureEmptyLine } from '../../extensions/toolbar/commands'

const getTitle = (state: FigureModalSource) => {
  switch (state) {
    case FigureModalSource.FILE_UPLOAD:
      return 'Upload from computer'
    case FigureModalSource.FILE_TREE:
      return 'Insert from project files'
    case FigureModalSource.FROM_URL:
      return 'Insert from URL'
    case FigureModalSource.OTHER_PROJECT:
      return 'Insert from another project'
    case FigureModalSource.EDIT_FIGURE:
      return 'Edit figure'
    default:
      return 'Insert image'
  }
}

export const FigureModal = memo(function FigureModal() {
  return (
    <FigureModalProvider>
      <FigureModalContent />
    </FigureModalProvider>
  )
})

const FigureModalContent = () => {
  const {
    source,
    dispatch,
    helpShown,
    getPath,
    width,
    includeCaption,
    includeLabel,
    sourcePickerShown,
  } = useFigureModalContext()

  const listener = useCallback(
    (event: Event) => {
      const { detail: source } = event as CustomEvent<FigureModalSource>
      dispatch({ source })
    },
    [dispatch]
  )

  useEffect(() => {
    window.addEventListener('figure-modal:open', listener)

    return () => {
      window.removeEventListener('figure-modal:open', listener)
    }
  }, [listener])

  const { dispatch: updateExistingFigure } =
    useFigureModalExistingFigureContext()

  const view = useCodeMirrorViewContext()

  const hide = useCallback(() => {
    dispatch({ source: FigureModalSource.NONE })
    view.requestMeasure()
    view.focus()
  }, [dispatch, view])

  useEffect(() => {
    const listener = () => {
      const figure = view.state.field<FigureData>(editFigureData, false)
      if (!figure) {
        return
      }
      updateExistingFigure({
        name: figure.file.path,
        hasComplexGraphicsArgument:
          figure.unknownGraphicsArguments !== undefined,
      })
      dispatch({
        source: FigureModalSource.EDIT_FIGURE,
        width: figure.width ?? 0.5,
        includeCaption: figure.caption !== null,
        includeLabel: figure.label !== null,
      })
    }

    window.addEventListener('figure-modal:open-modal', listener)

    return () => {
      window.removeEventListener('figure-modal:open-modal', listener)
    }
  }, [view, dispatch, updateExistingFigure])

  const insert = useCallback(async () => {
    const figure = view.state.field<FigureData>(editFigureData, false)

    if (!getPath) {
      throw new Error('Cannot insert figure without a file path')
    }
    let path: string
    try {
      path = await getPath()
    } catch (error) {
      dispatch({ error: String(error) })
      return
    }
    const labelCommand = includeLabel ? '\n\\label{fig:enter-label}' : ''
    const captionCommand = includeCaption ? '\n\\caption{Enter Caption}' : ''

    if (figure) {
      // Updating existing figure
      const hadCaptionBefore = figure.caption !== null
      const hadLabelBefore = figure.label !== null
      const changes: ChangeSpec[] = []
      if (!hadCaptionBefore && includeCaption) {
        // We should insert a caption
        changes.push({
          from: figure.graphicsCommand.to,
          insert: captionCommand,
        })
      }
      if (!hadLabelBefore && includeLabel) {
        // We should insert a label
        changes.push({
          from: figure.caption?.to ?? figure.graphicsCommand.to,
          insert: labelCommand,
        })
      }
      if (hadCaptionBefore && !includeCaption) {
        // We should remove the caption
        changes.push({
          from: figure.caption!.from,
          to: figure.caption!.to,
          insert: '',
        })
      }
      if (hadLabelBefore && !includeLabel) {
        // We should remove th label
        changes.push({
          from: figure.label!.from,
          to: figure.label!.to,
          insert: '',
        })
      }
      if (!figure.unknownGraphicsArguments) {
        // We understood the arguments, and should update the width
        if (figure.graphicsCommandArguments) {
          changes.push({
            from: figure.graphicsCommandArguments.from,
            to: figure.graphicsCommandArguments.to,
            insert: `width=${width}\\linewidth`,
          })
        } else {
          // Insert new args
          changes.push({
            from: figure.file.from - 1,
            insert: `[width=${width}\\linewidth]`,
          })
        }
      }
      changes.push({ from: figure.file.from, to: figure.file.to, insert: path })
      view.dispatch({
        changes: view.state.changes(changes),
        effects: editFigureDataEffect.of(null),
      })
    } else {
      view.dispatch(
        view.state.changeByRange(range => {
          const { pos, suffix } = ensureEmptyLine(view.state, range)
          const graphicxCommand = `\\includegraphics[width=${width}\\linewidth]{${path}}`
          const changes: ChangeSpec = view.state.changes({
            insert: `\\begin{figure}\n\\centering\n${graphicxCommand}${captionCommand}${labelCommand}${
              labelCommand || captionCommand ? '\n' : '' // Add an extra newline if we've added a caption or label
            }\\end{figure}${suffix}`,
            from: pos,
          })

          return { range: range.map(changes), changes }
        })
      )
    }
    hide()
  }, [getPath, view, hide, includeCaption, includeLabel, width, dispatch])

  const onDelete = useCallback(() => {
    const figure = view.state.field<FigureData>(editFigureData, false)
    if (!figure) {
      dispatch({ error: "Couldn't remove figure" })
      return
    }
    view.dispatch({
      effects: editFigureDataEffect.of(null),
      changes: view.state.changes({
        from: figure.from,
        to: figure.to,
        insert: '',
      }),
    })
    dispatch({ sourcePickerShown: false })
    hide()
  }, [view, hide, dispatch])

  const onCancel = useCallback(() => {
    dispatch({ sourcePickerShown: false })
    view.dispatch({ effects: editFigureDataEffect.of(null) })
    hide()
  }, [hide, view, dispatch])

  if (source === FigureModalSource.NONE) {
    return null
  }
  return (
    <AccessibleModal onHide={hide} className="figure-modal" show>
      <Modal.Header closeButton>
        <Modal.Title>
          {helpShown
            ? 'Help'
            : sourcePickerShown
            ? 'Replace figure'
            : getTitle(source)}{' '}
          <SplitTestBadge
            splitTestName="figure-modal"
            displayOnVariants={['enabled']}
          />
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <FigureModalBody />
      </Modal.Body>

      <Modal.Footer>
        <FigureModalFooter
          onInsert={insert}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </Modal.Footer>
    </AccessibleModal>
  )
}
