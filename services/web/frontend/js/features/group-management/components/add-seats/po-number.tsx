import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormControl, FormGroup, FormLabel } from 'react-bootstrap'
import FormText from '@/shared/components/form/form-text'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'

type PoNumberProps = {
  error: string | undefined
  validate: (value: string | undefined) => Promise<boolean>
}

function PoNumber({ error, validate }: PoNumberProps) {
  const { t } = useTranslation()
  const [isPoNumberChecked, setIsPoNumberChecked] = useState(false)

  return (
    <>
      <FormGroup className="mt-3">
        <OLFormCheckbox
          label={t('i_want_to_add_a_po_number')}
          id="po-number-checkbox"
          checked={isPoNumberChecked}
          onChange={e => setIsPoNumberChecked(e.target.checked)}
        />
      </FormGroup>
      {isPoNumberChecked && (
        <FormGroup className="mt-2" controlId="po-number">
          <FormLabel>{t('po_number')}</FormLabel>
          <FormControl
            type="text"
            required
            className="w-25"
            name="po_number"
            onChange={async e => await validate(e.target.value)}
            isInvalid={Boolean(error)}
          />
          {Boolean(error) && <FormText type="error">{error}</FormText>}
        </FormGroup>
      )}
    </>
  )
}

export default PoNumber
