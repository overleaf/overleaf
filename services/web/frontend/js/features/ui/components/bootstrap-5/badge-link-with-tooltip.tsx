import { OverlayTrigger, Tooltip } from 'react-bootstrap-5'
import type { MergeAndOverride } from '../../../../../../types/utils'
import BadgeLink, { type BadgeLinkProps } from './badge-link'
import { useEffect, useRef, useState } from 'react'
import classNames from 'classnames'

type BadgeLinkWithTooltipProps = MergeAndOverride<
  BadgeLinkProps,
  {
    placement?: 'top' | 'right' | 'bottom' | 'left'
    tooltipTitle: string
  }
>

function getElementWidth(el: Element) {
  const elComputedStyle = window.getComputedStyle(el)
  const elPaddingX =
    parseFloat(elComputedStyle.paddingLeft) +
    parseFloat(elComputedStyle.paddingRight)
  const elBorderX =
    parseFloat(elComputedStyle.borderLeftWidth) +
    parseFloat(elComputedStyle.borderRightWidth)
  return el.scrollWidth - elPaddingX - elBorderX
}

function BadgeLinkWithTooltip({
  children,
  tooltipTitle,
  placement,
  ...rest
}: BadgeLinkWithTooltipProps) {
  const badgeContentRef = useRef<HTMLElement>(null)
  const [showTooltip, setShowTooltip] = useState(true)
  const [noMaxWidth, setNoMaxWidth] = useState(false)

  const badgeLinkClasses = classNames({ 'badge-link-no-max-width': noMaxWidth })

  const renderTooltip = (props: any) => {
    if (showTooltip) {
      return (
        <Tooltip
          id={`badge-tooltip-${rest.href.replace(/\//g, '-')}`}
          {...props}
        >
          {tooltipTitle}
        </Tooltip>
      )
    } else {
      return <></>
    }
  }

  useEffect(() => {
    if (badgeContentRef.current) {
      // Check if tooltip needed.
      // If .badge-content does not extend beyond max-width limit on
      // .badge then tooltip is not needed. max-width is always
      // removed when withTooltip exists and tooltip is not needed
      // to avoid any differences in width calculation after font
      // loaded (for example, Noto sans). Othwerise, badge might get
      // clipped due to font loaded causing .badge-content to be
      // greater than .badge max-width and no tooltip was determined
      // to be needed with default font (for example, sans-serif)
      const badgeContentWidth = badgeContentRef.current.scrollWidth
      if (badgeContentRef.current?.parentElement) {
        const badgeWidth = getElementWidth(
          badgeContentRef.current?.parentElement
        )
        if (badgeContentWidth <= badgeWidth) {
          // no tooltip and remove max-width
          setNoMaxWidth(true)
          setShowTooltip(false)
        }
      }
    }
  }, [])

  return (
    <OverlayTrigger placement={placement || 'bottom'} overlay={renderTooltip}>
      <span>
        <BadgeLink
          {...rest}
          badgeContentRef={badgeContentRef}
          badgeLinkClasses={badgeLinkClasses}
        >
          {children}
        </BadgeLink>
      </span>
    </OverlayTrigger>
  )
}

export default BadgeLinkWithTooltip
