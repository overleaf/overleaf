import { ListGroupItem, ListGroupItemProps } from 'react-bootstrap-5'
import {
  ListGroupItem as BS3ListGroupItem,
  ListGroupItemProps as BS3ListGroupItemProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLListGroupItemProps = ListGroupItemProps & {
  bs3Props?: BS3ListGroupItemProps
}

function OLListGroupItem(props: OLListGroupItemProps) {
  const { bs3Props, ...rest } = props

  const bs3ListGroupItemProps: BS3ListGroupItemProps = {
    children: rest.children,
    active: rest.active,
    disabled: rest.disabled,
    href: rest.href,
    onClick: rest.onClick as BS3ListGroupItemProps['onClick'],
    ...bs3Props,
  }

  const extraProps = getAriaAndDataProps(rest)
  const as = rest.as ?? 'button'

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3ListGroupItem {...bs3ListGroupItemProps} {...extraProps} />}
      bs5={
        <ListGroupItem
          {...rest}
          as={as}
          type={as === 'button' ? 'button' : undefined}
        />
      }
    />
  )
}

export default OLListGroupItem
