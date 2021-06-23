import { useMemo } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

function Pagination({ currentPage, totalPages, handlePageClick }) {
  const { t } = useTranslation()

  const maxOtherPageButtons = useMemo(() => {
    let maxOtherPageButtons = 4 // does not include current page, prev/next buttons
    if (totalPages < maxOtherPageButtons + 1) {
      maxOtherPageButtons = totalPages - 1
    }
    return maxOtherPageButtons
  }, [totalPages])

  const pageButtons = useMemo(() => {
    const result = []
    let nextPage = currentPage + 1
    let prevPage = currentPage - 1

    function calcPages() {
      if (nextPage && nextPage <= totalPages) {
        result.push(nextPage)
        nextPage++
      } else {
        nextPage = undefined
      }

      if (prevPage && prevPage > 0) {
        result.push(prevPage)
        prevPage--
      } else {
        prevPage = undefined
      }
    }

    while (result.length < maxOtherPageButtons) {
      calcPages()
    }

    result.push(currentPage) // wait until prev/next calculated to add current
    result.sort((a, b) => a - b) // sort numerically

    return result
  }, [currentPage, totalPages, maxOtherPageButtons])

  const morePrevPages = useMemo(() => {
    return pageButtons[0] !== 1 && currentPage - maxOtherPageButtons / 2 > 1
  }, [pageButtons, currentPage, maxOtherPageButtons])

  const moreNextPages = useMemo(() => {
    return pageButtons[pageButtons.length - 1] < totalPages
  }, [pageButtons, totalPages])

  return (
    <nav role="navigation" aria-label={t('pagination_navigation')}>
      <ul className="pagination">
        {currentPage > 1 && (
          <li>
            <button
              onClick={event => handlePageClick(event, currentPage - 1)}
              aria-label={t('go_prev_page')}
            >
              «
            </button>
          </li>
        )}

        {morePrevPages && (
          <li>
            <span className="ellipses">…</span>
          </li>
        )}

        {pageButtons.map(page => (
          <PaginationItem
            key={`prev-page-${page}`}
            page={page}
            currentPage={currentPage}
            handlePageClick={handlePageClick}
          />
        ))}

        {moreNextPages && (
          <li>
            <span className="ellipses">…</span>
          </li>
        )}

        {currentPage < totalPages && (
          <li>
            <button
              onClick={event => handlePageClick(event, currentPage + 1)}
              aria-label={t('go_next_page')}
            >
              »
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}

function PaginationItem({ page, currentPage, handlePageClick }) {
  const { t } = useTranslation()
  const itemClassName = classNames({ active: currentPage === page })
  const ariaCurrent = currentPage === page
  const ariaLabel =
    currentPage === page ? t('page_current', { page }) : t('go_page', { page })
  return (
    <li className={itemClassName}>
      <button
        aria-current={ariaCurrent}
        onClick={event => handlePageClick(event, page)}
        aria-label={ariaLabel}
      >
        {page}
      </button>
    </li>
  )
}

function isPositiveNumber(value) {
  return typeof value === 'number' && value > 0
}

function isCurrentPageWithinTotalPages(currentPage, totalPages) {
  return currentPage <= totalPages
}

Pagination.propTypes = {
  currentPage: function (props, propName, componentName) {
    if (
      !isPositiveNumber(props[propName]) ||
      !isCurrentPageWithinTotalPages(props.currentPage, props.totalPages)
    ) {
      return new Error(
        'Invalid prop `' +
          propName +
          '` supplied to' +
          ' `' +
          componentName +
          '`. Validation failed.'
      )
    }
  },
  totalPages: function (props, propName, componentName) {
    if (!isPositiveNumber(props[propName])) {
      return new Error(
        'Invalid prop `' +
          propName +
          '` supplied to' +
          ' `' +
          componentName +
          '`. Validation failed.'
      )
    }
  },
  handlePageClick: PropTypes.func.isRequired,
}

PaginationItem.propTypes = {
  currentPage: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  handlePageClick: PropTypes.func.isRequired,
}

export default Pagination
