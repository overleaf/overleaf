import classNames from 'classnames'
import type { MergeAndOverride } from '../../../../../../types/utils'
import Badge, { type BadgeProps } from './badge'

type BadgeLinkProps = MergeAndOverride<
  BadgeProps,
  {
    href: string
  }
>

function BadgeLink({ href, children, ...badgeProps }: BadgeLinkProps) {
  const containerClass = classNames('badge-link', {
    [`badge-link-${badgeProps.bg}`]: badgeProps.bg,
  })

  return (
    <a className={containerClass} href={href}>
      <Badge {...badgeProps}>{children}</Badge>
    </a>
  )
}

export default BadgeLink
