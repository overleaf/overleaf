import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import {
  FigureModalProvider,
  FigureModalSource,
  useFigureModalContext,
  useFigureModalExistingFigureContext,
} from './figure-modal-context'
import { FigureModalFooter } from './figure-modal-footer'
import { lazy, memo, Suspense, useCallback, useEffect } from 'react'
import { useCodeMirrorViewContext } from '../codemirror-context'
import { ChangeSpec } from '@codemirror/state'
import { snippet } from '@codemirror/autocomplete'
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
import { FeedbackBadge } from '@/shared/components/feedback-badge'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'

const FigureModalBody = lazy(() => import('./figure-modal-body'))

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
      const { detail } = event as CustomEvent<{
        source: FigureModalSource
        fileId?: string
        filePath?: string
      }>
      dispatch({
        source: detail.source,
        selectedItemId: detail.fileId,
        getPath: detail.filePath ? async () => detail.filePath! : undefined,
      })
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
      const { pos, suffix } = ensureEmptyLine(
        view.state,
        view.state.selection.main
      )

      const widthArgument =
        width !== undefined ? `[width=${width}\\linewidth]` : ''
      const caption = includeCaption ? `\n\t\\caption{\${Enter Caption}}` : ''
      const label = includeLabel ? `\n\t\\label{\${fig:enter-label}}` : ''

      snippet(
        `\\begin{figure}
\t\\centering
\t\\includegraphics${widthArgument}{${path}}${caption}${label}
\\end{figure}${suffix}\${}`
      )(
        { state: view.state, dispatch: view.dispatch },
        { label: 'figure' },
        pos,
        pos
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
    <OLModal onHide={hide} className="figure-modal" show>
      <OLModalHeader closeButton>
        <OLModalTitle>
          {helpShown
            ? t('help')
            : sourcePickerShown
              ? t('replace_figure')
              : getTitle(source)}{' '}
          <FeedbackBadge
            id="figure-modal-feedback"
            url="https://forms.gle/PfEtwceYBNQ32DF4A"
            text="Please click to give feedback about editing figures."
          />
        </OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <Suspense fallback={<FullSizeLoadingSpinner minHeight="15rem" />}>
          <FigureModalBody />
        </Suspense>
      </OLModalBody>

      <OLModalFooter>
        <FigureModalFooter
          onInsert={insert}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      </OLModalFooter>
    </OLModal>
  )
}
