import React, { useRef, forwardRef, useImperativeHandle } from 'react'
import { SearchQuery } from '@codemirror/search'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { Form } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export const FullProjectSearchModifiers = forwardRef(
  function FullProjectSearchModifiers(props, ref) {
    const { t } = useTranslation()

    const caseSensitiveRef = useRef<HTMLInputElement>(null)
    const regexpRef = useRef<HTMLInputElement>(null)
    const wholeWordRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => {
      return {
        setQuery(query: SearchQuery) {
          caseSensitiveRef.current!.checked = query.caseSensitive
          regexpRef.current!.checked = query.regexp
          wholeWordRef.current!.checked = query.wholeWord
        },
      }
    }, [])

    return (
      <div className="full-project-search-modifiers" role="group">
        <OLTooltip
          id="project-search-caseSensitive"
          description={t('search_match_case')}
          overlayProps={{ placement: 'bottom' }}
        >
          <span>
            <Form.Check
              inline
              label="Aa"
              name="caseSensitive"
              type="checkbox"
              id="project-search-caseSensitive"
              ref={caseSensitiveRef}
            />
          </span>
        </OLTooltip>
        <OLTooltip
          id="project-search-regexp"
          description={t('search_regexp')}
          overlayProps={{ placement: 'bottom' }}
        >
          <span>
            <Form.Check
              inline
              label="[.*]"
              name="regexp"
              type="checkbox"
              id="project-search-regexp"
              ref={regexpRef}
            />
          </span>
        </OLTooltip>
        <OLTooltip
          id="project-search-wholeWord"
          description={t('search_whole_word')}
          overlayProps={{ placement: 'bottom' }}
        >
          <span>
            <Form.Check
              inline
              label="W"
              name="wholeWord"
              type="checkbox"
              id="project-search-wholeWord"
              ref={wholeWordRef}
            />
          </span>
        </OLTooltip>
      </div>
    )
  }
)
