import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel, Button } from 'react-bootstrap'
import classnames from 'classnames'

type AddressSecondLineProps = {
  errorFields: Record<string, boolean> | undefined
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function AddressSecondLine({
  errorFields,
  value,
  onChange,
}: AddressSecondLineProps) {
  const { t } = useTranslation()
  const [showAddressSecondLine, setShowAddressSecondLine] = useState(false)

  if (showAddressSecondLine) {
    return (
      <FormGroup
        controlId="address-line-2"
        className={classnames({ 'has-error': errorFields?.address2 })}
      >
        <ControlLabel>{t('address_second_line_optional')}</ControlLabel>
        <input
          id="address-line-2"
          className="form-control"
          name="address2"
          data-recurly="address2"
          type="text"
          required
          maxLength={255}
          onChange={onChange}
          value={value}
        />
      </FormGroup>
    )
  }

  return (
    <Button
      bsStyle="link"
      onClick={() => setShowAddressSecondLine(true)}
      className="mb-2 p-0"
    >
      + {t('add_another_address_line')}
    </Button>
  )
}

export default AddressSecondLine
