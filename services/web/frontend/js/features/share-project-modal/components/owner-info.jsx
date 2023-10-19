import { useProjectContext } from '../../../shared/context/project-context'
import { Col, Row } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export default function OwnerInfo() {
  const { t } = useTranslation()
  const { owner } = useProjectContext()

  return (
    <Row className="project-member">
      <Col xs={7}>{owner?.email}</Col>
      <Col xs={3} className="text-left">
        {t('owner')}
      </Col>
    </Row>
  )
}
