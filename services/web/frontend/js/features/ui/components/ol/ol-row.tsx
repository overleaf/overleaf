import { Row } from 'react-bootstrap-5'
import { Row as BS3Row } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLRowProps = React.ComponentProps<typeof Row>

function OLRow(props: OLRowProps) {
  return (
    <BootstrapVersionSwitcher
      bs3={<BS3Row className={props.className}>{props.children}</BS3Row>}
      bs5={<Row {...props} />}
    />
  )
}

export default OLRow
