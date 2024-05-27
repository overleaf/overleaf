import Tag from '@/features/ui/components/bootstrap-5/tag'
import BS3Tag from '@/shared/components/tag'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLTagProps = React.ComponentProps<typeof Tag> & {
  bs3Props?: React.ComponentProps<typeof BS3Tag>
}

function OLTag(props: OLTagProps) {
  const { bs3Props, ...rest } = props

  const bs3TagProps: React.ComponentProps<typeof BS3Tag> = {
    children: rest.children,
    prepend: rest.prepend,
    closeBtnProps: rest.closeBtnProps,
    className: rest.className,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Tag {...bs3TagProps} />}
      bs5={<Tag {...rest} />}
    />
  )
}

export default OLTag
