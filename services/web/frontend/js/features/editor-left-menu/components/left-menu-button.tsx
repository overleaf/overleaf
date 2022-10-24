import { PropsWithChildren } from 'react'
import Icon from '../../../shared/components/icon'

type Props = {
  onClick?: () => void
  icon: {
    type: string
    fw?: boolean
  }
  disabled?: boolean
  disabledAccesibilityText?: string
  type?: 'button' | 'link'
  href?: string
}

export default function LeftMenuButton({
  children,
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
        <Icon type={icon.type} fw={icon.fw} />
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
        <Icon type={icon.type} fw={icon.fw} />
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
        <Icon type={icon.type} fw={icon.fw} />
        <span>{children}</span>
      </a>
    )
  }
}
