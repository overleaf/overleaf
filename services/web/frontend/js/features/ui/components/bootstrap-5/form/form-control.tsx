import React, { forwardRef } from 'react'
import {
  Form,
  FormControlProps as BS5FormControlProps,
} from 'react-bootstrap-5'
import classnames from 'classnames'
import type { BsPrefixRefForwardingComponent } from 'react-bootstrap-5/helpers'

export type OLBS5FormControlProps = BS5FormControlProps & {
  prepend?: React.ReactNode
  append?: React.ReactNode
}

const FormControl: BsPrefixRefForwardingComponent<
  'input',
  OLBS5FormControlProps
> = forwardRef<HTMLInputElement, OLBS5FormControlProps>(
  ({ prepend, append, className, ...props }, ref) => {
    if (prepend || append) {
      const wrapperClassNames = classnames('form-control-wrapper', {
        'form-control-wrapper-sm': props.size === 'sm',
        'form-control-wrapper-lg': props.size === 'lg',
        'form-control-wrapper-disabled': props.disabled,
      })

      const formControlClassNames = classnames(className, {
        'form-control-offset-start': prepend,
        'form-control-offset-end': append,
      })

      return (
        <div className={wrapperClassNames}>
          {prepend && (
            <span className="form-control-start-icon">{prepend}</span>
          )}
          <Form.Control
            {...props}
            className={formControlClassNames}
            ref={ref}
          />
          {append && <span className="form-control-end-icon">{append}</span>}
        </div>
      )
    }

    return <Form.Control ref={ref} className={className} {...props} />
  }
)
FormControl.displayName = 'FormControl'

export default FormControl
