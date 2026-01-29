import {
  search as _search,
  setSearchQuery,
  getSearchQuery,
  openSearchPanel,
  SearchQuery,
  searchPanelOpen,
  searchKeymap,
  highlightSelectionMatches,
  togglePanel,
} from '@codemirror/search'
import {
  Decoration,
  EditorView,
  KeyBinding,
  keymap,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  SelectionRange,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { sendSearchEvent } from '@/features/event-tracking/search-events'
import { isVisual } from '@/features/source-editor/extensions/visual/visual'
import { beforeChangeDocEffect } from '@/features/source-editor/extensions/before-change-doc'

const restoreSearchQueryAnnotation = Annotation.define<boolean>()

const selectNextMatch = (query: SearchQuery, state: EditorState) => {
  if (!query.valid) {
    return false
  }

  let cursor = query.getCursor(state.doc, state.selection.main.from)

  let result = cursor.next()

  if (result.done) {
    cursor = query.getCursor(state.doc)
    result = cursor.next()
  }

  return result.done ? null : result.value
}

const storedSelectionEffect = StateEffect.define<EditorSelection | null>()

const storedSelectionState = StateField.define<EditorSelection | null>({
  create() {
    return null
  },
  update(value, tr) {
    if (value) {
      value = value.map(tr.changes)
    }

    for (const effect of tr.effects) {
      if (effect.is(storedSelectionEffect)) {
        value = effect.value
      } else if (effect.is(togglePanel) && effect.value === false) {
        value = null // clear the stored selection when closing the search panel
      }
    }

    return value
  },
  provide(f) {
    return [
      EditorView.decorations.from(f, selection => {
        if (!selection) {
          return Decoration.none
        }
        const decorations = selection.ranges
          .filter(range => !range.empty)
          .map(range =>
            Decoration.mark({
              class: 'ol-cm-stored-selection',
            }).range(range.from, range.to)
          )
        return Decoration.set(decorations)
      }),
    ]
  },
})

export const getStoredSelection = (state: EditorState) =>
  state.field(storedSelectionState)

export const setStoredSelection = (selection: EditorSelection | null) => {
  return {
    effects: [
      storedSelectionEffect.of(selection),
      // TODO: only disable selection highlighting if the current selection is a search match
      highlightSelectionMatchesConf.reconfigure(
        selection ? [] : highlightSelectionMatchesExtension
      ),
    ],
  }
}

const highlightSelectionMatchesConf = new Compartment()

const highlightSelectionMatchesExtension = highlightSelectionMatches({
  wholeWords: true,
})

const scrollToMatch = (range: SelectionRange, view: EditorView) => {
  const coords = {
    from: view.coordsAtPos(range.from),
    to: view.coordsAtPos(range.to),
  }
  const scrollRect = view.scrollDOM.getBoundingClientRect()
  const strategy =
    (coords.from && coords.from.top < scrollRect.top) ||
    (coords.to && coords.to.bottom > scrollRect.bottom)
      ? 'center'
      : 'nearest'

  return EditorView.scrollIntoView(range, {
    y: strategy,
  })
}

const searchEventKeymap: KeyBinding[] = [
  // record an event when the search panel is opened using the keyboard shortcut
  {
    key: 'Mod-f',
    preventDefault: true,
    scope: 'editor search-panel',
    run(view) {
      if (!searchPanelOpen(view.state)) {
        sendSearchEvent('search-open', {
          searchType: 'document',
          method: 'keyboard',
          mode: isVisual(view) ? 'visual' : 'source',
        })
      }
      return false // continue with the regular search shortcut
    },
  },
]

/**
 * A collection of extensions related to the search feature.
 */
export const search = (initialSearchQuery: SearchQuery | null) => {
  let open = false

  return [
    // keymap for search events
    Prec.high(keymap.of(searchEventKeymap)),

    // keymap for search
    keymap.of(searchKeymap),

    // highlight text which matches the current selection
    highlightSelectionMatchesConf.of(highlightSelectionMatchesExtension),

    // a stored selection for use in "within selection" searches
    storedSelectionState,

    /**
     * The CodeMirror `search` extension, configured to create a custom panel element
     * and to scroll the search match into the centre of the viewport when needed.
     */
    _search({
      literal: true,
      // centre the search match if it was outside the visible area
      scrollToMatch,
      createPanel: () => {
        const dom = document.createElement('div')
        dom.className = 'ol-cm-search'

        return {
          dom,
          mount() {
            open = true

            // focus the search input when the panel is already open
            const searchInput =
              dom.querySelector<HTMLInputElement>('[main-field]')
            if (searchInput) {
              searchInput.focus()
              searchInput.select()
            }
          },
          destroy() {
            open = false
          },
        }
      },
    }),

    // restore a stored search and re-open the search panel
    ViewPlugin.define(view => {
      if (initialSearchQuery) {
        const _searchQuery = initialSearchQuery
        window.setTimeout(() => {
          openSearchPanel(view)
          view.dispatch({
            effects: setSearchQuery.of(_searchQuery),
            annotations: restoreSearchQueryAnnotation.of(true),
          })
        }, 0)
      }

      return {
        // Fire an event containing the search query before a document change
        // so that it can be persisted for the next document
        update(update: ViewUpdate) {
          for (const tr of update.transactions) {
            for (const effect of tr.effects) {
              if (effect.is(beforeChangeDocEffect)) {
                const searchQuery = open ? getSearchQuery(view.state) : null
                window.dispatchEvent(
                  new CustomEvent('search-panel-before-doc-change', {
                    detail: searchQuery,
                  })
                )
              }
            }
          }
        },
      }
    }),

    // select a match while searching
    EditorView.updateListener.of(update => {
      // if the search panel wasn't open, don't select a match
      if (!searchPanelOpen(update.startState)) {
        return
      }

      for (const tr of update.transactions) {
        // avoid changing the selection and viewport when switching between files
        if (tr.annotation(restoreSearchQueryAnnotation)) {
          continue
        }

        for (const effect of tr.effects) {
          if (effect.is(setSearchQuery)) {
            const query = effect.value
            if (!query) return

            const currentQuery = getSearchQuery(tr.startState)
            if (currentQuery === query) {
              return // avoiding selecting the next match when opening the search form with no selected text
            }

            // The rest of this messes up searching in Vim, which is handled by
            // the Vim extension, so bail out here in Vim mode. Happily, the
            // Vim extension sticks an extra property on the query value that
            // can be checked
            if ('forVim' in query) return

            const next = selectNextMatch(query, tr.state)

            if (next) {
              // select a match if possible
              const spec: TransactionSpec = {
                selection: { anchor: next.from, head: next.to },
                userEvent: 'select.search',
              }

              // scroll into view if not opening the panel
              if (searchPanelOpen(tr.startState)) {
                spec.effects = scrollToMatch(
                  EditorSelection.range(next.from, next.to),
                  update.view
                )
              }

              update.view.dispatch(spec)
            } else {
              // clear the selection if the query became invalid
              const prevQuery = getSearchQuery(tr.startState)

              if (prevQuery.valid) {
                const { from } = tr.startState.selection.main

                update.view.dispatch({
                  selection: { anchor: from },
                })
              }
            }
          }
        }
      }
    }),
    searchFormTheme,
  ]
}

const searchFormTheme = EditorView.theme({
  '.ol-cm-search-form': {
    '--ol-cm-search-form-gap': '10px',
    '--ol-cm-search-form-button-margin': '3px',
    padding: 'var(--ol-cm-search-form-gap)',
    display: 'flex',
    gap: 'var(--ol-cm-search-form-gap)',
    background: 'var(--neutral-20)',
    '--ol-cm-search-form-focus-shadow':
      'inset 0 1px 1px rgb(0 0 0 / 8%), 0 0 8px rgb(102 175 233 / 60%)',
    '--ol-cm-search-form-error-shadow':
      'inset 0 1px 1px rgb(0 0 0 / 8%), 0 0 8px var(--red-50)',
    containerType: 'inline-size',
    '& .form-control-sm, & .btn-sm': {
      padding: 'var(--spacing-03) var(--spacing-05)',
    },
  },
  '&.ol-cm-search-form': {
    '--ol-cm-search-form-gap': 'var(--spacing-05)',
    '--ol-cm-search-form-button-margin': 'var(--spacing-02)',
    '--input-border': 'var(--border-primary)',
    '--input-border-focus': 'var(--border-active)',
  },
  '.ol-cm-search-controls': {
    display: 'grid',
    gridTemplateColumns: 'auto auto',
    gridTemplateRows: 'auto auto',
    gap: 'var(--ol-cm-search-form-gap)',
    flex: 1,
  },
  '@container (max-width: 450px)': {
    '.ol-cm-search-controls': {
      gridTemplateColumns: 'auto',
    },
  },
  '.ol-cm-search-form-row': {
    display: 'flex',
    gap: 'var(--ol-cm-search-form-gap)',
    justifyContent: 'space-between',
  },
  '.ol-cm-search-form-group': {
    display: 'flex',
    gap: 'var(--ol-cm-search-form-gap)',
    alignItems: 'center',
  },
  '.ol-cm-search-input-group': {
    border: '1px solid var(--input-border)',
    borderRadius: '20px',
    background: 'white',
    width: '100%',
    maxWidth: '50em',
    display: 'inline-flex',
    alignItems: 'center',
    '& input[type="text"]': {
      background: 'none',
      boxShadow: 'none',
    },
    '& input[type="text"]:focus': {
      outline: 'none',
      boxShadow: 'none',
    },
    '& .btn.btn': {
      background: 'var(--neutral-10)',
      color: 'var(--neutral-60)',
      borderRadius: '50%',
      height: '2em',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2em',
      marginRight: 'var(--ol-cm-search-form-button-margin)',
      '&.checked': {
        color: 'var(--white)',
        backgroundColor: 'var(--blue-50)',
      },
      '&:active': {
        boxShadow: 'none',
      },
    },
    '&:focus-within': {
      borderColor: 'var(--input-border-focus)',
      boxShadow: 'var(--ol-cm-search-form-focus-shadow)',
    },
  },
  '.ol-cm-search-input-group.ol-cm-search-input-error': {
    '&:focus-within': {
      borderColor: 'var(--input-border-danger)',
      boxShadow: 'var(--ol-cm-search-form-error-shadow)',
    },
  },
  '.ol-cm-search-form-input': {
    border: 'none',
  },
  '.ol-cm-search-input-button': {
    background: '#fff',
    color: 'inherit',
    border: 'none',
  },
  '.ol-cm-search-input-button.focused': {
    borderColor: 'var(--input-border-focus)',
    boxShadow: 'var(--ol-cm-search-form-focus-shadow)',
  },
  '.ol-cm-search-form-button-group': {
    flexShrink: 0,
  },
  '.ol-cm-search-form-position': {
    flexShrink: 0,
    color: 'var(--content-secondary)',
    minWidth: '5em',
  },
  '.ol-cm-search-hidden-inputs': {
    position: 'absolute',
    left: '-10000px',
  },
  '.ol-cm-search-form-close': {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'start',
  },
  '.ol-cm-search-replace-input': {
    order: 3,
  },
  '.ol-cm-search-replace-buttons': {
    order: 4,
  },
  '.ol-cm-stored-selection': {
    background: 'rgba(125, 125, 125, 0.1)',
    paddingTop: 'var(--half-leading)',
    paddingBottom: 'var(--half-leading)',
  },
  // set the default "match" style
  '.cm-selectionMatch, .cm-searchMatch': {
    backgroundColor: 'transparent',
    outlineOffset: '-1px',
    paddingTop: 'var(--half-leading)',
    paddingBottom: 'var(--half-leading)',
  },
  // make sure selectionMatch inside searchMatch doesn't have a background colour
  '.cm-searchMatch .cm-selectionMatch': {
    backgroundColor: 'transparent !important',
  },
})
