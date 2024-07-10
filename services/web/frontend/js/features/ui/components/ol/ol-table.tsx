import Table from '@/features/ui/components/bootstrap-5/table'
import { Table as BS3Table } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLFormProps = React.ComponentProps<typeof Table> & {
  bs3Props?: React.ComponentProps<typeof BS3Table>
}

function OLTable(props: OLFormProps) {
  const { bs3Props, container, ...rest } = props

  const bs3FormProps: React.ComponentProps<typeof BS3Table> = {
    bsClass: rest.className,
    condensed: rest.size === 'sm',
    children: rest.children,
    responsive:
      typeof rest.responsive !== 'string' ? rest.responsive : undefined,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Table {...bs3FormProps} />}
      bs5={<Table container={container} {...rest} />}
    />
  )
}

export default OLTable
