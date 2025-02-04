import MaterialIcon from '../../../../shared/components/material-icon'
import { isBootstrap5 } from '@/features/utils/bootstrap-5'

type RowLinkProps = {
  href: string
  heading: string
  subtext: string
  icon: string
}

export function RowLink(props: RowLinkProps) {
  return isBootstrap5() ? <BS5RowLink {...props} /> : <BS3RowLink {...props} />
}

function BS3RowLink({ href, heading, subtext, icon }: RowLinkProps) {
  return (
    <a href={href} className="row-link">
      <div className="icon">
        <MaterialIcon type={icon} />
      </div>
      <div className="text">
        <div className="heading">{heading}</div>
        <div className="subtext">{subtext}</div>
      </div>
      <div className="icon arrow">
        <MaterialIcon type="keyboard_arrow_right" />
      </div>
    </a>
  )
}

function BS5RowLink({ href, heading, subtext, icon }: RowLinkProps) {
  return (
    <li className="list-group-item row-link">
      <a href={href} className="row-link-inner">
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
