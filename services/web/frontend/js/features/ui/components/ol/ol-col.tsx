import { Col } from 'react-bootstrap-5'
import { Col as BS3Col } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLColProps = React.ComponentProps<typeof Col> & {
  bs3Props?: Record<string, unknown>
}

function OLCol(props: OLColProps) {
  const { bs3Props, ...rest } = props

  const getBs3Sizes = (obj: typeof rest) => {
    const bs5ToBs3SizeMap = {
      xs: 'xs',
      sm: 'xs',
      md: 'sm',
      lg: 'md',
      xl: 'lg',
      xxl: undefined,
    } as const

    const isBs5ToBs3SizeMapKey = (
      key: string
    ): key is keyof typeof bs5ToBs3SizeMap => {
      return key in bs5ToBs3SizeMap
    }

    const sizes = Object.entries(obj).reduce(
      (prev, [key, value]) => {
        if (isBs5ToBs3SizeMapKey(key)) {
          const bs3Size = bs5ToBs3SizeMap[key]

          if (bs3Size) {
            if (typeof value === 'object') {
              prev[bs3Size] = value.span
              prev[`${bs3Size}Offset`] = value.offset
            } else {
              prev[bs3Size] = value
            }
          }
        }

        return prev
      },
      {} as Record<string, (typeof rest)['xs']>
    )

    // Add a default sizing for `col-xs-12` if no sizing is available
    if (
      !Object.keys(sizes).some(key => ['xs', 'sm', 'md', 'lg'].includes(key))
    ) {
      sizes.xs = 12
    }

    return sizes
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
