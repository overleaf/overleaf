import { Form } from 'react-bootstrap-5'
import { Form as BS3Form, FormProps as BS3FormProps } from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { ComponentProps } from 'react'
import classnames from 'classnames'
import { getAriaAndDataProps } from '@/features/utils/bootstrap-5'

type OLFormProps = ComponentProps<typeof Form> & {
  bs3Props?: ComponentProps<typeof BS3Form>
}

function OLForm(props: OLFormProps) {
  const { bs3Props, ...rest } = props

  const bs3FormProps: BS3FormProps = {
    componentClass: rest.as,
    children: rest.children,
    id: rest.id,
    onSubmit: rest.onSubmit as BS3FormProps['onSubmit'],
    onClick: rest.onClick as BS3FormProps['onClick'],
    name: rest.name,
    noValidate: rest.noValidate,
    role: rest.role,
    ...bs3Props,
  }

  const bs3ClassName = classnames(
    rest.className,
    rest.validated ? 'was-validated' : null
  )

  // Get all `aria-*` and `data-*` attributes
  const extraProps = getAriaAndDataProps(rest)

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3Form className={bs3ClassName} {...bs3FormProps} {...extraProps} />
      }
      bs5={<Form {...rest} />}
    />
  )
}

export default OLForm
