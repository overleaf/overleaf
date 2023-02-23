import { useTranslation } from 'react-i18next'
import { Col, Row, Alert } from 'react-bootstrap'

function Canceled() {
  const { t } = useTranslation()

  return (
    <div className="container">
      <Row>
        <Col md={8} mdOffset={2}>
          <div className="card">
            <div className="page-header">
              <h2>{t('subscription_canceled')}</h2>
              <Alert bsStyle="info">
                <p>
                  {t('to_modify_your_subscription_go_to')}&nbsp;
                  <a href="/user/subscription" rel="noopener noreferrer">
                    {t('manage_subscription')}.
                  </a>
                </p>
              </Alert>
              <p>
                <a
                  className="btn btn-primary"
                  href="/project"
                  rel="noopener noreferrer"
                >
                  &lt; {t('back_to_your_projects')}
                </a>
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default Canceled
