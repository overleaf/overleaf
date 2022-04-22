import { useTranslation } from 'react-i18next'
import { Row, Col } from 'react-bootstrap'
import EmailCell from './cell'

function Header() {
  const { t } = useTranslation()

  return (
    <>
      <Row>
        <Col md={4} className="hidden-xs">
          <EmailCell>
            <strong>{t('email')}</strong>
          </EmailCell>
        </Col>
        <Col md={8} className="hidden-xs">
          <EmailCell>
            <strong>{t('institution_and_role')}</strong>
          </EmailCell>
        </Col>
      </Row>
      <div className="hidden-xs horizontal-divider" />
      <div className="hidden-xs horizontal-divider" />
    </>
  )
}

export default Header
