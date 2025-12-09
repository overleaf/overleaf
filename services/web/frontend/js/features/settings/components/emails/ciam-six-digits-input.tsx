import { forwardRef } from 'react'
import { Form, FormControlProps } from 'react-bootstrap'
import classnames from 'classnames'

interface CIAMSixDigitsInputProps extends FormControlProps {
  value: string | undefined
}

const separator = '\u2007' // figure space

const CIAMSixDigitsInput = forwardRef<
  HTMLInputElement,
  CIAMSixDigitsInputProps
>(({ className, onChange, value, ...props }, ref) => {
  const group1 = value?.slice(0, 3) || ''
  const group2 = value?.slice(3, 6) || ''
  const displayValue = group2 ? `${group1}${separator}${group2}` : group1
  return (
    <div className="ciam-six-digits-container">
      <Form.Control
        ref={ref}
        {...props}
        size="lg"
        onChange={v => {
          const inputValue = v.target.value
          const sanitizedValue = inputValue.replaceAll(/\D/g, '').slice(0, 6)
          onChange?.({
            ...v,
            target: { ...v.target, value: sanitizedValue },
            currentTarget: { ...v.currentTarget, value: sanitizedValue },
          })
        }}
        value={displayValue}
        className={classnames(
          'form-control-ds ciam-six-digits-input',
          className
        )}
        maxLength={7}
        inputMode="numeric"
        autoComplete="off"
        data-1p-ignore
      />
      {group1.length > 0 && (
        <span className="ciam-six-digits-dash" aria-hidden>
          -
        </span>
      )}
    </div>
  )
})
CIAMSixDigitsInput.displayName = 'CIAMSixDigitsInput'

export default CIAMSixDigitsInput
