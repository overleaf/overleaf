import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import {
  addCommentStateField,
  buildAddNewCommentRangeEffect,
} from '@/features/source-editor/extensions/add-comment'
import { getTooltip } from '@codemirror/view'
import useViewerPermissions from '@/shared/hooks/use-viewer-permissions'
import usePreviousValue from '@/shared/hooks/use-previous-value'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useReviewPanelViewActionsContext } from '../context/review-panel-view-context'

const ReviewTooltipMenu: FC = () => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const isViewer = useViewerPermissions()
  const [show, setShow] = useState(true)

  const tooltipState = state.field(addCommentStateField, false)?.tooltip
  const previousTooltipState = usePreviousValue(tooltipState)

  useEffect(() => {
    if (tooltipState !== null && previousTooltipState === null) {
      setShow(true)
    }
  }, [tooltipState, previousTooltipState])

  if (isViewer || !show || !tooltipState) {
    return null
  }

  const tooltipView = getTooltip(view, tooltipState)

  if (!tooltipView) {
    return null
  }

  return ReactDOM.createPortal(
    <ReviewTooltipMenuContent setShow={setShow} />,
    tooltipView.dom
  )
}

const ReviewTooltipMenuContent: FC<{
  setShow: Dispatch<SetStateAction<boolean>>
}> = ({ setShow }) => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()
  const { setReviewPanelOpen } = useLayoutContext()
  const { setView } = useReviewPanelViewActionsContext()

  const handleClick = () => {
    setReviewPanelOpen(true)
    setView('cur_file')

    view.dispatch({
      effects: buildAddNewCommentRangeEffect(state.selection.main),
    })
    setShow(false)
  }

  return (
    <div className="review-tooltip-menu">
      <button
        className="review-tooltip-menu-button review-tooltip-add-comment-button"
        onClick={handleClick}
      >
        <MaterialIcon type="chat" />
        {t('add_comment')}
      </button>
    </div>
  )
}

export default ReviewTooltipMenu
