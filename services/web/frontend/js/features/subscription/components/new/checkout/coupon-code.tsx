import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import { usePaymentContext } from '../../../context/payment-context'

type CouponCodeProps = {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function CouponCode(props: CouponCodeProps) {
  const { t } = useTranslation()
  const { addCoupon } = usePaymentContext()

  const handleApplyCoupon = (e: React.FocusEvent<HTMLInputElement>) => {
    addCoupon(e.target.value)
  }

  return (
    <FormGroup controlId="coupon-code">
      <ControlLabel>{t('coupon_code')}</ControlLabel>
      <input
        id="coupon-code"
        className="form-control"
        data-recurly="coupon"
        type="text"
        onBlur={handleApplyCoupon}
        onChange={props.onChange}
        value={props.value}
      />
    </FormGroup>
  )
}

export default CouponCode
