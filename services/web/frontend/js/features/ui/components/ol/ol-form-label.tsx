import { Form } from 'react-bootstrap-5'
import { ControlLabel as BS3FormLabel } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type OLFormLabelProps = React.ComponentProps<(typeof Form)['Label']> & {
  bs3Props?: Record<string, unknown>
}

function OLFormLabel(props: OLFormLabelProps) {
  const { bs3Props, ...rest } = props

  const bs3FormLabelProps: React.ComponentProps<typeof BS3FormLabel> = {
    children: rest.children,
    htmlFor: rest.htmlFor,
    srOnly: rest.visuallyHidden,
    className: rest.className,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3FormLabel {...bs3FormLabelProps} />}
      bs5={<Form.Label {...rest} />}
    />
  )
}

export default OLFormLabel
