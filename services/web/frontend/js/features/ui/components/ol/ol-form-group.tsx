import { FormGroupProps } from 'react-bootstrap-5'
import { FormGroup as BS3FormGroup } from 'react-bootstrap'
import FormGroup from '@/features/ui/components/bootstrap-5/form/form-group'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLFormGroupProps = FormGroupProps & {
  bs3Props?: Record<string, unknown>
}

function OLFormGroup(props: OLFormGroupProps) {
  const { bs3Props, ...rest } = props

  const bs3FormGroupProps: React.ComponentProps<typeof BS3FormGroup> = {
    children: rest.children,
    controlId: rest.controlId,
    className: rest.className,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3FormGroup {...bs3FormGroupProps} />}
      bs5={<FormGroup {...rest} />}
    />
  )
}

export default OLFormGroup
