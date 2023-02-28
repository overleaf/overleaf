import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel, Col } from 'react-bootstrap'
import Icon from '../../../../../shared/components/icon'

type PaymentMethodToggleProps = {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  paymentMethod: string
}

function PaymentMethodToggle(props: PaymentMethodToggleProps) {
  const { t } = useTranslation()

  return (
    <FormGroup
      className="payment-method-toggle"
      data-testid="payment-method-toggle"
    >
      <hr className="thin" />
      <div className="radio">
        <Col xs={8}>
          <ControlLabel>
            <input
              type="radio"
              name="payment_method"
              value="credit_card"
              onChange={props.onChange}
              checked={props.paymentMethod === 'credit_card'}
            />
            <strong>
              {t('card_payment')}&nbsp;
              <span className="hidden-xs">
                <Icon type="cc-visa" /> <Icon type="cc-mastercard" />{' '}
                <Icon type="cc-amex" />
              </span>
            </strong>
          </ControlLabel>
        </Col>
        <Col xs={4}>
          <ControlLabel>
            <input
              type="radio"
              name="payment_method"
              value="paypal"
              onChange={props.onChange}
              checked={props.paymentMethod === 'paypal'}
            />
            <strong>
              PayPal&nbsp;
              <span className="hidden-xs">
                <Icon type="cc-paypal" />
              </span>
            </strong>
          </ControlLabel>
        </Col>
      </div>
    </FormGroup>
  )
}

export default PaymentMethodToggle
