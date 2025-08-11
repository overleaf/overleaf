import MaterialIcon from '../../../../shared/components/material-icon'

type RowLinkProps = {
  href: string
  heading: string
  subtext: string
  icon: string
  onClick?: () => void
}

export function RowLink({
  href,
  heading,
  subtext,
  icon,
  onClick,
}: RowLinkProps) {
  return (
    <li className="list-group-item row-link">
      <a href={href} className="row-link-inner" onClick={onClick}>
        <MaterialIcon type={icon} className="p-2 p-md-3" />
        <div className="flex-grow-1">
          <strong>{heading}</strong>
          <div>{subtext}</div>
        </div>
        <MaterialIcon type="keyboard_arrow_right" className="p-2 p-md-3" />
      </a>
    </li>
  )
}
