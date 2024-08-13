import { Form } from 'react-bootstrap-5'
import {
  HelpBlock as BS3HelpBlock,
  HelpBlockProps as BS3HelpBlockProps,
} from 'react-bootstrap'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { ComponentProps } from 'react'
import classnames from 'classnames'
import FormFeedback from '@/features/ui/components/bootstrap-5/form/form-feedback'

type OLFormFeedbackProps = Pick<
  ComponentProps<typeof Form.Control.Feedback>,
  'type' | 'className' | 'children'
> & {
  bs3Props?: Record<string, unknown>
}

function OLFormFeedback(props: OLFormFeedbackProps) {
  const { bs3Props, children, ...bs5Props } = props

  const bs3HelpBlockProps: BS3HelpBlockProps = {
    className: classnames(
      bs5Props.className,
      bs5Props.type === 'invalid' ? 'invalid-only' : null
    ),
    children,
    ...bs3Props,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<BS3HelpBlock {...bs3HelpBlockProps} />}
      bs5={<FormFeedback {...bs5Props}>{children}</FormFeedback>}
    />
  )
}

export default OLFormFeedback
