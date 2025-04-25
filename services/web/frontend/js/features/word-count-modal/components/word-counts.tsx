import {
  ServerWordCountData,
  WordCountData,
} from '@/features/word-count-modal/components/word-count-data'
import { useTranslation } from 'react-i18next'
import { FC } from 'react'
import { Container, Row, Col } from 'react-bootstrap-5'
import OLNotification from '@/features/ui/components/ol/ol-notification'

export const WordCounts: FC<
  | {
      data: ServerWordCountData
      source: 'server'
    }
  | {
      data: WordCountData
      source: 'client'
    }
> = ({ data, source }) => {
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

      {source === 'client' ? (
        <>
          <Row>
            <Col xs={4}>
              <div className="pull-right">Text:</div>
            </Col>
            <Col xs={6}>{data.textWords}</Col>
          </Row>

          <Row>
            <Col xs={4}>
              <div className="pull-right">Headers:</div>
            </Col>
            <Col xs={6}>{data.headWords}</Col>
          </Row>

          <Row>
            <Col xs={4}>
              <div className="pull-right">Captions:</div>
            </Col>
            <Col xs={6}>{data.captionWords}</Col>
          </Row>

          <Row>
            <Col xs={4}>
              <div className="pull-right">Footnotes:</div>
            </Col>
            <Col xs={6}>{data.footnoteWords}</Col>
          </Row>
        </>
      ) : (
        <Row>
          <Col xs={4}>
            <div className="pull-right">{t('total_words')}:</div>
          </Col>
          <Col xs={6}>{data.textWords}</Col>
        </Row>
      )}

      {source === 'server' && (
        <>
          <Row>
            <Col xs={4}>
              <div className="pull-right">{t('headers')}:</div>
            </Col>
            <Col xs={6}>{data.headers}</Col>
          </Row>

          <Row>
            <Col xs={4}>
              <div className="pull-right">{t('math_inline')}:</div>
            </Col>
            <Col xs={6}>{data.mathInline}</Col>
          </Row>

          <Row>
            <Col xs={4}>
              <div className="pull-right">{t('math_display')}:</div>
            </Col>
            <Col xs={6}>{data.mathDisplay}</Col>
          </Row>
        </>
      )}
    </Container>
  )
}
