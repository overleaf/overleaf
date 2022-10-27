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
}

export default function LeftMenuButton({
  children,
  onClick,
  icon,
  disabled = false,
  disabledAccesibilityText,
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

  return (
    <button onClick={onClick} className="left-menu-button">
      <Icon type={icon.type} fw={icon.fw} />
      <span>{children}</span>
    </button>
  )
}
