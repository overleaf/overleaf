import { Form } from 'react-bootstrap-5'
import { FormGroup as BS3FormGroup } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLFormGroupProps = React.ComponentProps<(typeof Form)['Group']> & {
  bs3Props?: Record<string, unknown>
}

function OLFormGroup(props: OLFormGroupProps) {
  const { bs3Props, className, ...rest } = props

  const classNames = className ?? 'mb-3'

  const bs3FormGroupProps: React.ComponentProps<typeof BS3FormGroup> = {
    children: rest.children,
    controlId: rest.controlId,
    className,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3FormGroup {...bs3FormGroupProps} />}
      bs5={<Form.Group className={classNames} {...rest} />}
    />
  )
}

export default OLFormGroup
