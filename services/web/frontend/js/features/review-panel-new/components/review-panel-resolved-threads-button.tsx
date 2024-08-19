import React, { FC, useRef, useState } from 'react'
import Icon from '@/shared/components/icon'
import { ReviewPanelResolvedThreadsMenu } from './review-panel-resolved-threads-menu'
import { Overlay, Popover } from 'react-bootstrap'

export const ReviewPanelResolvedThreadsButton: FC = () => {
  const [expanded, setExpanded] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        className="resolved-comments-toggle"
        ref={buttonRef}
        onClick={() => setExpanded(true)}
      >
        <Icon type="inbox" fw />
      </button>
      {expanded && (
        <Overlay
          show
          onHide={() => setExpanded(false)}
          animation={false}
          container={this}
          containerPadding={0}
          placement="bottom"
          rootClose
          target={buttonRef.current ?? undefined}
        >
          <Popover
            id="popover-resolved-threads"
            className="review-panel-resolved-comments review-panel-new"
          >
            <ReviewPanelResolvedThreadsMenu />
          </Popover>
        </Overlay>
      )}
    </>
  )
}
