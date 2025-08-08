import { FC, useMemo } from 'react'
import { WordCountData } from '@/features/word-count-modal/components/word-count-data'
import { useTranslation } from 'react-i18next'
import { Container, Row, Col, Form } from 'react-bootstrap'
import OLNotification from '@/shared/components/ol/ol-notification'
import usePersistedState from '@/shared/hooks/use-persisted-state'

export const WordCountsClient: FC<{ data: WordCountData }> = ({ data }) => {
  const { t } = useTranslation()

  const [included, setIncluded] = usePersistedState<string[]>(
    'word-count-total',
    ['text']
  )

  const items = useMemo(() => {
    return [
      {
        key: 'text',
        label: t('text'),
        words: data.textWords,
        chars: data.textCharacters,
      },
      {
        key: 'headers',
        label: t('headers'),
        words: data.headWords,
        chars: data.headCharacters,
      },
      {
        key: 'abstract',
        label: t('abstract'),
        words: data.abstractWords,
        chars: data.abstractCharacters,
      },
      {
        key: 'captions',
        label: t('captions'),
        words: data.captionWords,
        chars: data.captionCharacters,
      },
      {
        key: 'footnotes',
        label: t('footnotes'),
        words: data.footnoteWords,
        chars: data.footnoteCharacters,
      },
      {
        key: 'other',
        label: t('other'),
        words: data.otherWords,
        chars: data.otherCharacters,
      },
    ]
  }, [data, t])

  const totals = useMemo(() => {
    const totals = {
      words: 0,
      chars: 0,
    }

    for (const item of items) {
      if (included.includes(item.key)) {
        totals.words += item.words
        totals.chars += item.chars
      }
    }

    return totals
  }, [included, items])

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

      {items.map(item => (
        <Row
          key={item.key}
          style={{
            borderBottom: '1px solid #eee',
            padding: 5,
            marginBottom: 5,
          }}
        >
          <Col
            style={{
              display: 'flex',
              alignItems: 'top',
              justifyContent: 'space-between',
            }}
          >
            <Form.Check
              type="checkbox"
              id={`word-count-${item.key}`}
              label={item.label}
              checked={included.includes(item.key)}
              onChange={event =>
                setIncluded(prevValue => {
                  return event.target.checked
                    ? prevValue.concat(item.key)
                    : prevValue.filter(key => key !== item.key)
                })
              }
              aria-label={`Include ${item.label} in total`}
            />
          </Col>
          <Col>
            {item.words} words
            <br />
            {item.chars} chars
          </Col>
        </Row>
      ))}

      <Row>
        <Col style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 'bold' }}>
            {t('total')}: {totals.words} words
            <br />
            {totals.chars} chars
          </span>
        </Col>
      </Row>
    </Container>
  )
}
