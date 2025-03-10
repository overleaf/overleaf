import { PropsWithChildren } from 'react'
import MaterialIcon from '@/shared/components/material-icon'

type Props = {
  onClick?: () => void
  icon?: string
  svgIcon?: React.ReactElement | null
  disabled?: boolean
  disabledAccesibilityText?: string
  type?: 'button' | 'link'
  href?: string
}

function LeftMenuButtonIcon({
  svgIcon,
  icon,
}: {
  svgIcon?: React.ReactElement | null
  icon?: string
}) {
  if (svgIcon) {
    return <div className="material-symbols">{svgIcon}</div>
  } else if (icon) {
    return <MaterialIcon type={icon} />
  } else return null
}

export default function LeftMenuButton({
  children,
  svgIcon,
  onClick,
  icon,
  disabled = false,
  disabledAccesibilityText,
  type = 'button',
  href,
}: PropsWithChildren<Props>) {
  if (disabled) {
    return (
      <div className="left-menu-button link-disabled">
        <LeftMenuButtonIcon svgIcon={svgIcon} icon={icon} />
        <span>{children}</span>
        {disabledAccesibilityText ? (
          <span className="sr-only">{disabledAccesibilityText}</span>
        ) : null}
      </div>
    )
  }

  if (type === 'button') {
    return (
      <button onClick={onClick} className="left-menu-button">
        <LeftMenuButtonIcon svgIcon={svgIcon} icon={icon} />
        <span>{children}</span>
      </button>
    )
  } else {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="left-menu-button"
      >
        <LeftMenuButtonIcon svgIcon={svgIcon} icon={icon} />
        <span>{children}</span>
      </a>
    )
  }
}
