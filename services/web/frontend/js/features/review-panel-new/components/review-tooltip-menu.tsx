import {
  CSSProperties,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import ReactDOM from 'react-dom'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import {
  buildAddNewCommentRangeEffect,
  reviewTooltipStateField,
} from '@/features/source-editor/extensions/review-tooltip'
import { EditorView, getTooltip } from '@codemirror/view'
import useViewerPermissions from '@/shared/hooks/use-viewer-permissions'
import usePreviousValue from '@/shared/hooks/use-previous-value'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useReviewPanelViewActionsContext } from '../context/review-panel-view-context'
import {
  useRangesActionsContext,
  useRangesContext,
} from '../context/ranges-context'
import { isInsertOperation } from '@/utils/operations'
import { isCursorNearViewportEdge } from '@/features/source-editor/utils/is-cursor-near-edge'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { numberOfChangesInSelection } from '../utils/changes-in-selection'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import classNames from 'classnames'
import useEventListener from '@/shared/hooks/use-event-listener'
import getMeta from '@/utils/meta'

const isReviewerRoleEnabled = getMeta('ol-isReviewerRoleEnabled')
const TRACK_CHANGES_ON_WIDGET_HEIGHT = 25
const EDIT_MODE_SWITCH_WIDGET_HEIGHT = 40
const CM_LINE_RIGHT_PADDING = isReviewerRoleEnabled ? 8 : 2
const TOOLTIP_SHOW_DELAY = 120

const ReviewTooltipMenu: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const isViewer = useViewerPermissions()
  const [show, setShow] = useState(true)
  const { setView } = useReviewPanelViewActionsContext()
  const { setReviewPanelOpen } = useLayoutContext()

  const tooltipState = state.field(reviewTooltipStateField, false)?.tooltip
  const previousTooltipState = usePreviousValue(tooltipState)

  useEffect(() => {
    if (tooltipState !== null && previousTooltipState === null) {
      setShow(true)
    }
  }, [tooltipState, previousTooltipState])

  const addComment = useCallback(() => {
    setReviewPanelOpen(true)
    setView('cur_file')

    const commentPos = state.selection.main.anchor
    const effects = isCursorNearViewportEdge(view, commentPos)
      ? [
          buildAddNewCommentRangeEffect(state.selection.main),
          EditorView.scrollIntoView(commentPos, { y: 'center' }),
        ]
      : [buildAddNewCommentRangeEffect(state.selection.main)]

    view.dispatch({ effects })
    setShow(false)
  }, [setReviewPanelOpen, setView, setShow, view, state.selection.main])

  useEventListener('add-new-review-comment', addComment)

  if (isViewer || !show || !tooltipState) {
    return null
  }

  const tooltipView = getTooltip(view, tooltipState)

  if (!tooltipView) {
    return null
  }

  return ReactDOM.createPortal(
    <ReviewTooltipMenuContent onAddComment={addComment} />,
    tooltipView.dom
  )
}

const ReviewTooltipMenuContent: FC<{ onAddComment: () => void }> = ({
  onAddComment,
}) => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const { reviewPanelOpen } = useLayoutContext()
  const ranges = useRangesContext()
  const { acceptChanges, rejectChanges } = useRangesActionsContext()
  const { showGenericConfirmModal } = useModalsContext()
  const { wantTrackChanges } = useEditorManagerContext()
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties | undefined>()
  const [visible, setVisible] = useState(false)

  const changeIdsInSelection = useMemo(() => {
    return (ranges?.changes ?? [])
      .filter(({ op }) => {
        const opFrom = op.p
        const opLength = isInsertOperation(op) ? op.i.length : 0
        const opTo = opFrom + opLength
        const selection = state.selection.main
        return opFrom >= selection.from && opTo <= selection.to
      })
      .map(({ id }) => id)
  }, [ranges, state.selection.main])

  const acceptChangesHandler = useCallback(() => {
    const nChanges = numberOfChangesInSelection(ranges, state.selection.main)
    showGenericConfirmModal({
      message: t('confirm_accept_selected_changes', { count: nChanges }),
      title: t('accept_selected_changes'),
      onConfirm: () => {
        acceptChanges(...changeIdsInSelection)
      },
      primaryVariant: 'danger',
    })
  }, [
    acceptChanges,
    changeIdsInSelection,
    ranges,
    showGenericConfirmModal,
    state.selection.main,
    t,
  ])

  const rejectChangesHandler = useCallback(() => {
    const nChanges = numberOfChangesInSelection(ranges, state.selection.main)
    showGenericConfirmModal({
      message: t('confirm_reject_selected_changes', { count: nChanges }),
      title: t('reject_selected_changes'),
      onConfirm: () => {
        rejectChanges(...changeIdsInSelection)
      },
      primaryVariant: 'danger',
    })
  }, [
    showGenericConfirmModal,
    t,
    ranges,
    state.selection.main,
    rejectChanges,
    changeIdsInSelection,
  ])

  const showChangesButtons = changeIdsInSelection.length > 0

  useEffect(() => {
    view.requestMeasure({
      key: 'review-tooltip-outside-viewport',
      read(view) {
        const cursorCoords = view.coordsAtPos(view.state.selection.main.head)

        if (!cursorCoords) {
          return
        }

        const scrollDomRect = view.scrollDOM.getBoundingClientRect()
        const contentDomRect = view.contentDOM.getBoundingClientRect()
        const editorRightPos = contentDomRect.right - CM_LINE_RIGHT_PADDING

        if (
          cursorCoords.top > scrollDomRect.top &&
          cursorCoords.top < scrollDomRect.bottom
        ) {
          return
        }

        let widgetOffset = 0
        if (isReviewerRoleEnabled) {
          widgetOffset = EDIT_MODE_SWITCH_WIDGET_HEIGHT
        } else if (wantTrackChanges && !reviewPanelOpen) {
          widgetOffset = TRACK_CHANGES_ON_WIDGET_HEIGHT
        }

        return {
          position: 'fixed' as const,
          top: scrollDomRect.top + widgetOffset,
          right: window.innerWidth - editorRightPos,
        }
      },
      write(res) {
        setTooltipStyle(res)
      },
    })
  }, [view, reviewPanelOpen, wantTrackChanges])

  useEffect(() => {
    setVisible(false)
    const timeout = setTimeout(() => {
      setVisible(true)
    }, TOOLTIP_SHOW_DELAY)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div
      className={classNames('review-tooltip-menu', {
        'review-tooltip-menu-visible': visible,
      })}
      style={tooltipStyle}
    >
      <button
        className="review-tooltip-menu-button review-tooltip-add-comment-button"
        onClick={onAddComment}
      >
        <MaterialIcon type="chat" />
        {t('add_comment')}
      </button>
      {showChangesButtons && (
        <>
          <div className="review-tooltip-menu-divider" />
          <OLTooltip
            id="accept-all-changes"
            description={t('accept_selected_changes')}
          >
            <button
              className="review-tooltip-menu-button"
              onClick={acceptChangesHandler}
            >
              <MaterialIcon type="check" />
            </button>
          </OLTooltip>

          <OLTooltip
            id="reject-all-changes"
            description={t('reject_selected_changes')}
          >
            <button
              className="review-tooltip-menu-button"
              onClick={rejectChangesHandler}
            >
              <MaterialIcon type="clear" />
            </button>
          </OLTooltip>
        </>
      )}
    </div>
  )
}

export default ReviewTooltipMenu
