import React, { forwardRef } from 'react'
import { Form, FormControlProps } from 'react-bootstrap'
import classnames from 'classnames'

interface DSFormControlProps extends FormControlProps {
  prepend?: React.ReactNode
  append?: React.ReactNode
}

const DSFormControl = forwardRef<HTMLInputElement, DSFormControlProps>(
  ({ prepend, append, className, ...props }, ref) => {
    if (prepend || append) {
      const wrapperClassNames = classnames(
        'form-control-wrapper-ds form-control-wrapper-lg-ds',
        {
          'form-control-wrapper-disabled-ds': props.disabled,
        }
      )

      const formControlClassNames = classnames('form-control-ds', className, {
        'form-control-offset-start-ds': prepend,
        'form-control-offset-end-ds': append,
      })

      return (
        <div className={wrapperClassNames}>
          {prepend && (
            <span className="form-control-start-icon-ds">{prepend}</span>
          )}
          <Form.Control
            {...props}
            className={formControlClassNames}
            ref={ref}
          />
          {append && <span className="form-control-end-icon-ds">{append}</span>}
        </div>
      )
    }

    return (
      <Form.Control
        ref={ref}
        size="lg"
        className={classnames('form-control-ds', className)}
        {...props}
      />
    )
  }
)
DSFormControl.displayName = 'DSFormControl'

export default DSFormControl
