import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-editor'
import {
  addCommentStateField,
  buildAddNewCommentRangeEffect,
} from '@/features/source-editor/extensions/add-comment'
import { getTooltip } from '@codemirror/view'
import useViewerPermissions from '@/shared/hooks/use-viewer-permissions'
import usePreviousValue from '@/shared/hooks/use-previous-value'

const AddCommentTooltip: FC = () => {
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
    <AddCommentTooltipContent setShow={setShow} />,
    tooltipView.dom
  )
}

const AddCommentTooltipContent: FC<{
  setShow: Dispatch<SetStateAction<boolean>>
}> = ({ setShow }) => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()

  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent<{ isOpen: boolean }>('set-review-panel-open', {
        detail: { isOpen: true },
      })
    )

    view.dispatch({
      effects: buildAddNewCommentRangeEffect(state.selection.main),
    })
    setShow(false)
  }

  return (
    <button className="review-panel-add-comment-tooltip" onClick={handleClick}>
      <MaterialIcon type="chat" />
      {t('add_comment')}
    </button>
  )
}

export default AddCommentTooltip
