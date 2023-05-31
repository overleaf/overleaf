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
  PastedImageData,
  editFigureData,
  editFigureDataEffect,
} from '../../extensions/figure-modal'
import { ensureEmptyLine } from '../../extensions/toolbar/commands'
import { useTranslation } from 'react-i18next'
import useEventListener from '../../../../shared/hooks/use-event-listener'
import { prepareLines } from '../../utils/prepare-lines'

export const FigureModal = memo(function FigureModal() {
  return (
    <FigureModalProvider>
      <FigureModalContent />
    </FigureModalProvider>
  )
})

const FigureModalContent = () => {
  const { t } = useTranslation()

  const getTitle = useCallback(
    (state: FigureModalSource) => {
      switch (state) {
        case FigureModalSource.FILE_UPLOAD:
          return t('upload_from_computer')
        case FigureModalSource.FILE_TREE:
          return t('insert_from_project_files')
        case FigureModalSource.FROM_URL:
          return t('insert_from_url')
        case FigureModalSource.OTHER_PROJECT:
          return t('insert_from_another_project')
        case FigureModalSource.EDIT_FIGURE:
          return t('edit_figure')
        default:
          return t('insert_image')
      }
    },
    [t]
  )

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

  useEventListener(
    'figure-modal:open-modal',
    useCallback(() => {
      const figure = view.state.field<FigureData>(editFigureData, false)
      if (!figure) {
        return
      }
      updateExistingFigure({
        name: figure.file.path,
        // The empty string should *not* be a complex argument
        hasComplexGraphicsArgument: Boolean(figure.unknownGraphicsArguments),
      })
      dispatch({
        source: FigureModalSource.EDIT_FIGURE,
        width: figure.width,
        includeCaption: figure.caption !== null,
        includeLabel: figure.label !== null,
      })
    }, [view, dispatch, updateExistingFigure])
  )

  useEventListener(
    'figure-modal:paste-image',
    useCallback(
      (image: CustomEvent<PastedImageData>) => {
        dispatch({
          source: FigureModalSource.FILE_UPLOAD,
          pastedImageData: image.detail,
        })
      },
      [dispatch]
    )
  )

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
    const labelCommand = includeLabel ? '\\label{fig:enter-label}' : ''
    const captionCommand = includeCaption ? '\\caption{Enter Caption}' : ''

    if (figure) {
      // Updating existing figure
      const hadCaptionBefore = figure.caption !== null
      const hadLabelBefore = figure.label !== null
      const changes: ChangeSpec[] = []
      if (!hadCaptionBefore && includeCaption) {
        // We should insert a caption
        changes.push({
          from: figure.graphicsCommand.to,
          insert: prepareLines(
            ['', captionCommand],
            view.state,
            figure.graphicsCommand.to
          ),
        })
      }
      if (!hadLabelBefore && includeLabel) {
        const from = figure.caption?.to ?? figure.graphicsCommand.to
        // We should insert a label
        changes.push({
          from,
          insert: prepareLines(['', labelCommand], view.state, from),
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
      if (!figure.unknownGraphicsArguments && width) {
        // We understood the arguments, and should update the width
        if (figure.graphicsCommandArguments !== null) {
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
          const widthArgument =
            width !== undefined ? `[width=${width}\\linewidth]` : ''
          const changes: ChangeSpec = view.state.changes({
            insert: prepareLines(
              [
                '\\begin{figure}',
                '\t\\centering',
                `\t\\includegraphics${widthArgument}{${path}}`,
                `\t${captionCommand}` || null,
                `\t${labelCommand}` || null,
                `\\end{figure}${suffix}`,
              ],
              view.state,
              pos
            ),
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
            ? t('help')
            : sourcePickerShown
            ? t('replace_figure')
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
