import { FC, useMemo } from 'react'
import { WordCountData } from '@/features/word-count-modal/components/word-count-data'
import { useTranslation } from 'react-i18next'
import { Container, Row, Col, Form } from 'react-bootstrap'
import OLNotification from '@/shared/components/ol/ol-notification'
import usePersistedState from '@/shared/hooks/use-persisted-state'

const numberFormat = new Intl.NumberFormat()

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
        label: t('main_text'),
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

      <Row className="mb-4">
        <table style={{ width: 'auto' }}>
          <thead>
            <tr>
              <th />
              <th className="visually-hidden">{t('words')}</th>
              <th className="visually-hidden">{t('characters')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th style={{ width: 100 }}>{t('total_words_lower')}:</th>
              <td style={{ width: 100, textAlign: 'right' }}>
                {numberFormat.format(totals.words)}
              </td>
              <td style={{ width: 250, textAlign: 'right' }}>
                <b style={{ marginRight: 10 }} aria-hidden="true">
                  {t('characters')}:
                </b>{' '}
                {numberFormat.format(totals.chars)}
              </td>
            </tr>
            {items.map(item => (
              <tr key={item.key}>
                <th style={{ fontWeight: 'normal', paddingLeft: 20 }}>
                  <Form.Check
                    type="checkbox"
                    id={`word-count-${item.key}`}
                    label={`${item.label}:`}
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
                </th>
                <td style={{ textAlign: 'right' }}>
                  {numberFormat.format(item.words)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {numberFormat.format(item.chars)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Row>

      <Row className="border-top py-2">
        <Col xs={12}>
          <b>{t('headers')}:</b> {data.headers}
        </Col>
      </Row>

      <Row className="border-top py-2">
        <Col xs={12}>
          <b>{t('inline_math')}:</b> {data.mathInline}
        </Col>
      </Row>

      <Row className="border-top py-2 pb-0">
        <Col xs={12}>
          <b>{t('display_math')}:</b> {data.mathDisplay}
        </Col>
      </Row>
    </Container>
  )
}
