import _ from 'lodash'
import DOMPurify from 'dompurify'
import { formatWikiHit, searchWiki } from '../algolia-search/search-wiki'
import { sendMB } from '../../infrastructure/event-tracking'
import { materialIcon } from '@/features/utils/material-icon'

export function setupSearch(formEl: Element) {
  const inputEl = formEl.querySelector('[name="subject"]') as HTMLInputElement
  const resultsContainerEl = formEl.querySelector(
    '[data-ol-search-results-container]'
  ) as HTMLElement
  const wrapperEl = formEl.querySelector(
    '[data-ol-search-results-wrapper]'
  ) as HTMLElement

  if (!inputEl || !resultsContainerEl || !wrapperEl) {
    return
  }

  let lastValue = ''

  function hideResults() {
    wrapperEl.setAttribute('hidden', '')
  }

  function showResults() {
    wrapperEl.removeAttribute('hidden')
  }

  async function handleChange() {
    const value = inputEl.value
    if (value === lastValue) return
    lastValue = value
    if (value.length < 3) {
      hideResults()
      return
    }

    DOMPurify.addHook('uponSanitizeElement', node => {
      if (node.nodeName === 'EM') {
        const strong = document.createElement('strong')
        strong.textContent = node.textContent
        node.parentNode?.replaceChild(strong, node)
      }
    })

    try {
      const { hits, nbHits } = await searchWiki(value, {
        hitsPerPage: 3,
        typoTolerance: 'strict',
      })

      resultsContainerEl.innerHTML = ''

      for (const hit of hits) {
        const { url, rawPageName, sectionName } = formatWikiHit(hit)
        const liEl = document.createElement('li')

        const linkEl = document.createElement('a')
        linkEl.className = 'dropdown-item'
        linkEl.href = url
        linkEl.target = '_blank'
        linkEl.rel = 'noopener noreferrer'
        linkEl.setAttribute('role', 'menuitem')
        liEl.append(linkEl)

        const contentWrapperEl = document.createElement('div')
        contentWrapperEl.className = 'dropdown-item-description-container'
        linkEl.append(contentWrapperEl)

        const pageNameEl = document.createElement('div')
        pageNameEl.innerHTML = DOMPurify.sanitize(rawPageName)
        contentWrapperEl.append(pageNameEl)

        const iconEl = materialIcon('open_in_new')
        iconEl.classList.add('dropdown-item-trailing-icon')
        iconEl.setAttribute('aria-hidden', 'true')
        contentWrapperEl.append(iconEl)

        if (sectionName) {
          const sectionEl = document.createElement('span')
          sectionEl.className = 'dropdown-item-description'
          sectionEl.innerHTML = DOMPurify.sanitize(sectionName)
          contentWrapperEl.append(sectionEl)
        }

        resultsContainerEl.append(liEl)
      }
      if (nbHits > 0) {
        showResults()
        sendMB('contact-form-suggestions-shown')
      } else {
        hideResults()
      }
    } catch (e) {
      hideResults()
    }

    DOMPurify.removeHook('uponSanitizeElement')
  }

  inputEl.addEventListener('input', _.debounce(handleChange, 350))

  function handleClickOutside(event: Event) {
    const target = event.target as Element
    if (!wrapperEl.contains(target) && !inputEl.contains(target)) {
      hideResults()
    }
  }

  document.addEventListener('click', handleClickOutside)

  function handleKeyDown(event: Event) {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key === 'Escape') {
      if (!wrapperEl.hasAttribute('hidden')) {
        hideResults()
        keyboardEvent.stopPropagation()
        keyboardEvent.preventDefault()
      }
    }
  }

  formEl.addEventListener('keydown', handleKeyDown)

  handleChange()
}
