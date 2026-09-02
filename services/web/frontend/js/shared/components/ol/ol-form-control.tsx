import React, { forwardRef } from 'react'
import { Form, FormControlProps as FormControlProps } from 'react-bootstrap'
import classnames from 'classnames'
import OLSpinner from './ol-spinner'

export type OLFormControlProps = FormControlProps & {
  prepend?: React.ReactNode
  append?: React.ReactNode
  rows?: number
  'data-ol-dirty'?: unknown
  'main-field'?: any // For the CM6's benefit in the editor search panel
  loading?: boolean
}

const OLFormControl = forwardRef<HTMLInputElement, OLFormControlProps>(
  ({ prepend, append, loading, className, ...props }, ref) => {
    const resolvedAppend = loading ? <OLSpinner size="sm" /> : append

    if (prepend || resolvedAppend) {
      const wrapperClassNames = classnames('form-control-wrapper', {
        'form-control-wrapper-sm': props.size === 'sm',
        'form-control-wrapper-lg': props.size === 'lg',
        'form-control-wrapper-disabled': props.disabled,
      })

      const formControlClassNames = classnames(className, {
        'form-control-offset-start': prepend,
        'form-control-offset-end': resolvedAppend,
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
          {resolvedAppend && (
            <span className="form-control-end-icon">{resolvedAppend}</span>
          )}
        </div>
      )
    }

    return <Form.Control ref={ref} className={className} {...props} />
  }
)
OLFormControl.displayName = 'OLFormControl'

export default OLFormControl
