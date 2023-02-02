import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'
import PaymentPreviewPanel from './payment-preview/payment-preview-panel'
import CheckoutPanel from './checkout/checkout-panel'
import { Col, Row } from 'react-bootstrap'
import { PaymentProvider } from '../../context/payment-context'
import getMeta from '../../../../utils/meta'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  const publicKey = getMeta('ol-recurlyApiKey')

  return (
    <PaymentProvider publicKey={publicKey}>
      <div className="container">
        <Row className="card-group">
          <Col md={3} mdPush={1}>
            <div className="card card-highlighted">
              <PaymentPreviewPanel />
            </div>
          </Col>
          <Col md={5} mdPush={1}>
            <div className="card card-highlighted card-border">
              <CheckoutPanel />
            </div>
          </Col>
        </Row>
      </div>
    </PaymentProvider>
  )
}

export default Root
