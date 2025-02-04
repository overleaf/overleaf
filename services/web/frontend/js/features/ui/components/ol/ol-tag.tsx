import Tag from '@/features/ui/components/bootstrap-5/tag'
import BS3Tag from '@/shared/components/tag'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { forwardRef } from 'react'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLTagProps = React.ComponentProps<typeof Tag> & {
  bs3Props?: React.ComponentProps<typeof BS3Tag>
}

const OLTag = forwardRef<HTMLElement, OLTagProps>((props: OLTagProps, ref) => {
  const { bs3Props, ...rest } = props

  const bs3TagProps: React.ComponentProps<typeof BS3Tag> = {
    children: rest.children,
    prepend: rest.prepend,
    closeBtnProps: rest.closeBtnProps,
    className: rest.className,
    onClick: rest.onClick,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur,
    onMouseOver: rest.onMouseOver,
    onMouseOut: rest.onMouseOut,
    contentProps: rest.contentProps,
    ...getAriaAndDataProps(rest),
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Tag {...bs3TagProps} />}
      bs5={<Tag ref={ref} {...rest} />}
    />
  )
})

OLTag.displayName = 'OLTag'

export default OLTag
