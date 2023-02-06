import { useTranslation } from 'react-i18next'
import { Row, Col } from 'react-bootstrap'
import { Plan } from '../../../../../../../types/subscription/plan'

type PriceSwitchHeaderProps = {
  planCode: Plan['planCode']
  planCodes: Array<Plan['planCode']>
}

function PriceSwitchHeader({ planCode, planCodes }: PriceSwitchHeaderProps) {
  const { t } = useTranslation()
  const showStudentDisclaimer = planCodes.includes(planCode)

  return (
    <div className="price-switch-header">
      <Row>
        <Col xs={9}>
          <h2>{t('select_a_payment_method')}</h2>
        </Col>
      </Row>
      {showStudentDisclaimer && (
        <Row>
          <Col xs={12}>
            <p className="student-disclaimer">{t('student_disclaimer')}</p>
          </Col>
        </Row>
      )}
    </div>
  )
}

export default PriceSwitchHeader
