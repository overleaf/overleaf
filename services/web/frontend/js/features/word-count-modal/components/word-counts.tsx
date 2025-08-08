import { FC } from 'react'
import { ServerWordCountData } from '@/features/word-count-modal/components/word-count-data'
import { useTranslation } from 'react-i18next'
import { Container, Row, Col } from 'react-bootstrap'
import OLNotification from '@/shared/components/ol/ol-notification'

export const WordCounts: FC<{
  data: ServerWordCountData
}> = ({ data }) => {
  const { t } = useTranslation()

  return (
    <Container fluid>
      {data.messages && (
        <Row>
          <Col xs={12}>
            <OLNotification
              type="error"
              content={
                <p style={{ whiteSpace: 'pre-wrap' }}>{data.messages}</p>
              }
            />
          </Col>
        </Row>
      )}

      <Row>
        <Col xs={4}>
          <div className="float-end">{t('total_words')}:</div>
        </Col>
        <Col xs={6}>{data.textWords}</Col>
      </Row>
      <Row>
        <Col xs={4}>
          <div className="float-end">{t('headers')}:</div>
        </Col>
        <Col xs={6}>{data.headers}</Col>
      </Row>

      <Row>
        <Col xs={4}>
          <div className="float-end">{t('math_inline')}:</div>
        </Col>
        <Col xs={6}>{data.mathInline}</Col>
      </Row>

      <Row>
        <Col xs={4}>
          <div className="float-end">{t('math_display')}:</div>
        </Col>
        <Col xs={6}>{data.mathDisplay}</Col>
      </Row>
    </Container>
  )
}
