import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import OutlineList from './outline-list'

function OutlineRoot({ outline, jumpToLine, highlightedLine }) {
  const { t } = useTranslation()

  return (
    <div>
      {outline.length ? (
        <OutlineList
          outline={outline}
          jumpToLine={jumpToLine}
          isRoot
          highlightedLine={highlightedLine}
          containsHighlightedLine
        />
      ) : (
        <div className="outline-body-no-elements">
          {t('we_cant_find_any_sections_or_subsections_in_this_file')}.{' '}
          <a
            href="/learn/how-to/Using_the_File_Outline_feature"
            className="outline-body-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('find_out_more_about_the_file_outline')}
          </a>
        </div>
      )}
    </div>
  )
}

OutlineRoot.propTypes = {
  outline: PropTypes.array.isRequired,
  jumpToLine: PropTypes.func.isRequired,
  highlightedLine: PropTypes.number,
}

export default OutlineRoot
