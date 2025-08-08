import classNames from 'classnames'
import type { MergeAndOverride } from '../../../../../types/utils'
import Badge, { type BadgeProps } from './badge'

export type BadgeLinkProps = MergeAndOverride<
  BadgeProps,
  {
    href: string
    badgeContentRef?: React.RefObject<HTMLElement>
    badgeLinkClasses?: string
  }
>

function BadgeLink({
  href,
  badgeLinkClasses,
  children,
  ...badgeProps
}: BadgeLinkProps) {
  const containerClass = classNames(badgeLinkClasses, 'badge-link', {
    [`badge-link-${badgeProps.bg}`]: badgeProps.bg,
  })

  return (
    <a className={containerClass} href={href}>
      <Badge {...badgeProps}>{children}</Badge>
    </a>
  )
}

export default BadgeLink
