import { Label } from 'react-bootstrap'
import Badge from '@/features/ui/components/bootstrap-5/badge'
import BS3Badge from '@/shared/components/badge'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLBadgeProps = React.ComponentProps<typeof Badge> & {
  bs3Props?: {
    bsStyle?: React.ComponentProps<typeof Label>['bsStyle'] | null
  }
}

function OLBadge(props: OLBadgeProps) {
  const { bs3Props, ...rest } = props

  let bs3BadgeProps: React.ComponentProps<typeof BS3Badge> = {
    prepend: rest.prepend,
    children: rest.children,
    className: rest.className,
    bsStyle: rest.bg,
  }

  if (bs3Props) {
    const { bsStyle, ...restBs3Props } = bs3Props

    bs3BadgeProps = {
      ...bs3BadgeProps,
      ...restBs3Props,
      bsStyle: 'bsStyle' in bs3Props ? bsStyle : rest.bg,
    }
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Badge {...bs3BadgeProps} />}
      bs5={<Badge {...rest} />}
    />
  )
}

export default OLBadge
