import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import { Card as BSCard, CardBody, Col, Row } from 'react-bootstrap-5'
import IconButton from '@/features/ui/components/bootstrap-5/icon-button'

type CardProps = {
  children: React.ReactNode
}

function Card({ children }: CardProps) {
  const { t } = useTranslation()
  const groupName = getMeta('ol-groupName')
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return (
    <div className="container">
      <Row>
        <Col xl={{ span: 4, offset: 4 }} md={{ span: 6, offset: 3 }}>
          <div className="group-heading" data-testid="group-heading">
            <IconButton
              variant="ghost"
              href="/user/subscription"
              size="lg"
              icon="arrow_back"
              accessibilityLabel={t('back_to_subscription')}
            />
            <h2>{groupName || t('group_subscription')}</h2>
          </div>
          <BSCard>
            <CardBody>{children}</CardBody>
          </BSCard>
        </Col>
      </Row>
    </div>
  )
}

export default Card
