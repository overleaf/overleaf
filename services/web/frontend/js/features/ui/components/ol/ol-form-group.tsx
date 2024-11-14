import { FormGroupProps } from 'react-bootstrap-5'
import {
  FormGroup as BS3FormGroup,
  FormGroupProps as BS3FormGroupProps,
  FormControl,
} from 'react-bootstrap'
import FormGroup from '@/features/ui/components/bootstrap-5/form/form-group'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import classNames from 'classnames'

type OLFormGroupProps = FormGroupProps & {
  bs3Props?: {
    withFeedback?: boolean
    hiddenLabel?: boolean
    validationState?: BS3FormGroupProps['validationState']
  }
}

function OLFormGroup(props: OLFormGroupProps) {
  const { bs3Props, className, ...rest } = props
  const { withFeedback, hiddenLabel, ...bs3PropsRest } = bs3Props || {}

  const bs3FormGroupProps: BS3FormGroupProps = {
    controlId: rest.controlId,
    className: classNames(className, { 'hidden-label': hiddenLabel }),
    ...bs3PropsRest,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={
        <BS3FormGroup {...bs3FormGroupProps}>
          {rest.children}
          {withFeedback ? <FormControl.Feedback /> : null}
        </BS3FormGroup>
      }
      bs5={<FormGroup className={className} {...rest} />}
    />
  )
}

export default OLFormGroup
