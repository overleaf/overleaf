import _ from 'lodash'
import { formatWikiHit, searchWiki } from '../algolia-search/search-wiki'

function setupSearch(formEl) {
  const inputEl = formEl.querySelector('[data-ol-search-input]')
  const resultsEl = formEl.querySelector('[data-ol-search-results]')
  const wrapperEl = formEl.querySelector('[data-ol-search-results-wrapper]')
  const noResultsEl = formEl.querySelector('[data-ol-search-no-results]')
  const srHelpMsgEl = formEl.querySelector('[data-ol-search-sr-help-message]')

  function hideResultsPane() {
    wrapperEl.hidden = true
  }
  function showResultsPane() {
    wrapperEl.hidden = false
    hideNoResultsMsg()
  }
  function hideNoResultsMsg() {
    noResultsEl.hidden = true
  }
  function showNoResultsMsg() {
    noResultsEl.hidden = false
    hideResultsPane()
  }

  let lastValue = ''

  async function handleChange() {
    const value = inputEl.value
    if (value === lastValue) return
    lastValue = value

    if (value.length === 0) {
      hideResultsPane()
      hideNoResultsMsg()
      return
    }

    try {
      const { hits, nbHits } = await searchWiki(value, {
        hitsPerPage: 20,
      })
      if (nbHits === 0) {
        showNoResultsMsg()
        return
      }

      if (nbHits > 20) {
        srHelpMsgEl.innerText = `Showing first 20 results of ${nbHits} for ${value}`
      } else {
        srHelpMsgEl.innerText = `${nbHits} results for ${value}`
      }

      resultsEl.innerText = ''
      for (const hit of hits) {
        const { url, pageName, content } = formatWikiHit(hit)
        const linkEl = document.createElement('a')
        linkEl.className = 'search-result card'
        linkEl.href = url

        const cardBodyEl = document.createElement('div')
        cardBodyEl.className = 'card-body'

        const headerEl = document.createElement('span')
        headerEl.className = 'search-result-header'
        headerEl.innerHTML = pageName
        cardBodyEl.append(headerEl)

        if (content) {
          const contentEl = document.createElement('div')
          contentEl.className = 'search-result-content'
          contentEl.innerHTML = content
          cardBodyEl.append(contentEl)
        }

        linkEl.append(cardBodyEl)

        resultsEl.append(linkEl)
      }
      showResultsPane()
    } catch (e) {
      showNoResultsMsg()
    }
  }
  function updateClearBtnVisibility() {
    const value = inputEl.value
    formEl.querySelectorAll('[data-ol-clear-search]').forEach(el => {
      el.hidden = value === ''
    })
  }

  function handleClear() {
    inputEl.value = ''
    hideResultsPane()
    hideNoResultsMsg()
    updateClearBtnVisibility()
  }

  formEl.querySelectorAll('[data-ol-clear-search]').forEach(el => {
    el.addEventListener('click', handleClear)
  })
  formEl.addEventListener('submit', evt => {
    evt.preventDefault()
    return false
  })
  inputEl.addEventListener('input', _.debounce(handleChange, 100))
  inputEl.addEventListener('input', updateClearBtnVisibility)

  // display initial results
  handleChange()
  updateClearBtnVisibility()
}

document.querySelectorAll('[data-ol-faq-search]').forEach(setupSearch)
