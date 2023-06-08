import MaterialIcon from '../../../../shared/components/material-icon'

type RowLinkProps = {
  href: string
  heading: string
  subtext: string
  icon: string
}

export function RowLink({ href, heading, subtext, icon }: RowLinkProps) {
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
