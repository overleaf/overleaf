import { Col } from 'react-bootstrap-5'
import { Col as BS3Col } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLColProps = React.ComponentProps<typeof Col> & {
  bs3Props?: Record<string, unknown>
}

function OLCol(props: OLColProps) {
  const { bs3Props, ...rest } = props
  const sizes = new Set(['xs', 'sm', 'md', 'lg', 'xl', 'xxl'])

  const getBs3Sizes = (obj: typeof rest) => {
    return Object.entries(obj).reduce(
      (prev, [key, value]) => {
        if (sizes.has(key)) {
          if (typeof value === 'object') {
            prev[key] = value.span
            prev[`${key}Offset`] = value.offset
          } else {
            prev[key] = value
          }
        }
        return prev
      },
      {} as Record<string, (typeof rest)['xs']>
    )
  }

  const bs3ColProps: React.ComponentProps<typeof BS3Col> = {
    children: rest.children,
    className: rest.className,
    ...getBs3Sizes(rest),
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Col {...bs3ColProps} />}
      bs5={<Col {...rest} />}
    />
  )
}

export default OLCol
