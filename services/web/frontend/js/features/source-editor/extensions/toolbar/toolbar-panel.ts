import { StateEffect, StateField } from '@codemirror/state'
import { EditorView, showPanel } from '@codemirror/view'
import { isBootstrap5 } from '@/features/utils/bootstrap-5'

const toggleToolbarEffect = StateEffect.define<boolean>()
const toolbarState = StateField.define<boolean>({
  create: () => true,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(toggleToolbarEffect)) {
        value = effect.value
      }
    }
    return value
  },
  provide: f => showPanel.from(f, on => (on ? createToolbarPanel : null)),
})

export function createToolbarPanel() {
  const dom = document.createElement('div')
  dom.classList.add('ol-cm-toolbar-portal')
  return { dom, top: true }
}

const toolbarTheme = EditorView.theme({
  '.ol-cm-toolbar': {
    backgroundColor: 'var(--editor-toolbar-bg)',
    color: 'var(--toolbar-btn-color)',
    flex: 1,
    display: 'flex',
    overflowX: 'hidden',
  },
  '&.overall-theme-dark .ol-cm-toolbar': {
    '& img': {
      filter: 'invert(1)',
    },
  },
  '.ol-cm-toolbar-overflow': {
    display: 'flex',
    flexWrap: 'wrap',
  },
  '#popover-toolbar-overflow': {
    padding: 0,
    borderColor: 'rgba(125, 125, 125, 0.2)',
    backgroundColor: 'var(--editor-toolbar-bg)',
    color: 'var(--toolbar-btn-color)',
    '& .popover-content, & .popover-body': {
      padding: 0,
    },
    '& .popover-body': {
      color: 'inherit',
    },
    '& .arrow, & .popover-arrow': {
      borderBottomColor: 'rgba(125, 125, 125, 0.2)',
      '&:after': {
        borderBottomColor: 'var(--editor-toolbar-bg)',
      },
    },
  },
  '.ol-cm-toolbar-button-menu-popover': {
    backgroundColor: 'initial',
    '& > .popover-content, & > .popover-body': {
      padding: 0,
      color: 'initial',
    },
    '& .arrow, & .popover-arrow': {
      display: 'none',
    },
    '& .list-group': {
      marginBottom: 0,
      backgroundColor: 'var(--editor-toolbar-bg)',
      borderRadius: '4px',
    },
    '& .list-group-item': {
      width: '100%',
      textAlign: 'start',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      color: 'var(--toolbar-btn-color)',
      borderColor: 'var(--editor-toolbar-bg)',
      background: 'none',
      '&:hover, &:focus': {
        backgroundColor: 'rgba(125, 125, 125, 0.2)',
      },
    },
  },
  '.ol-cm-toolbar-button-group': {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    flexWrap: 'nowrap',
    padding: '0 4px',
    margin: '4px 0',
    lineHeight: '1',
    borderLeft: '1px solid rgba(125, 125, 125, 0.3)',
    '&.ol-cm-toolbar-end': {
      borderLeft: 'none',
    },
    '&.ol-cm-toolbar-stretch': {
      flex: 1,
      '.editor-toggle-switch + &': {
        borderLeft: 'none', // avoid a left border when no toolbar buttons are shown
      },
    },
    '&.overflow-hidden': {
      borderLeft: 'none',
      width: 0,
      padding: 0,
    },
  },
  '.ol-cm-toolbar-button': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    margin: '0 1px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: isBootstrap5() ? 'var(--border-radius-base)' : '1px',
    lineHeight: '1',
    width: '24px',
    height: '24px',
    overflow: 'hidden',
    color: 'inherit',
    '&:hover, &:focus, &:active, &.active': {
      backgroundColor: 'rgba(125, 125, 125, 0.1)',
      color: 'inherit',
      boxShadow: 'none',
      '&[aria-disabled="true"]': {
        opacity: '0.2',
      },
    },
    '&.active, &:active': {
      backgroundColor: 'rgba(125, 125, 125, 0.2)',
    },
    '&[aria-disabled="true"]': {
      opacity: '0.2',
      cursor: 'not-allowed',
    },
    '.overflow-hidden &': {
      display: 'none',
    },
    '&.ol-cm-toolbar-button-math': {
      fontFamily: '"Noto Serif", serif',
      fontSize: '16px',
      fontWeight: 700,
    },
  },
  '&.overall-theme-dark .ol-cm-toolbar-button': {
    opacity: 0.8,
    '&:hover, &:focus, &:active, &.active': {
      backgroundColor: 'rgba(125, 125, 125, 0.2)',
    },
    '&.active, &:active': {
      backgroundColor: 'rgba(125, 125, 125, 0.4)',
    },
    '&[aria-disabled="true"]': {
      opacity: 0.2,
    },
  },
  '.ol-cm-toolbar-end': {
    justifyContent: 'flex-end',
    '& .badge': {
      marginRight: '5px',
    },
  },
  '.ol-cm-toolbar-overflow-toggle': {
    display: 'none',
    '&.ol-cm-toolbar-overflow-toggle-visible': {
      display: 'flex',
    },
  },
  '.ol-cm-toolbar-menu-toggle': {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    borderRadius: isBootstrap5() ? 'var(--border-radius-base)' : '0',
    opacity: 0.8,
    width: '120px',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 6px',
    '&:hover, &:focus, &.active': {
      backgroundColor: 'rgba(125, 125, 125, 0.1)',
      opacity: '1',
      color: 'inherit',
    },
    '& .caret': {
      marginTop: '0',
    },
  },
  '.ol-cm-toolbar-menu-popover': {
    border: 'none',
    borderRadius: '0',
    borderBottomLeftRadius: '4px',
    borderBottomRightRadius: '4px',
    boxShadow: '0 2px 5px rgb(0 0 0 / 20%)',
    backgroundColor: 'var(--editor-toolbar-bg)',
    color: 'var(--toolbar-btn-color)',
    padding: '0',
    '&.bottom': {
      marginTop: '1px',
    },
    '&.top': {
      marginBottom: '1px',
    },
    '& .arrow, & .popover-arrow': {
      display: 'none',
    },
    '& .popover-content, & > .popover-body': {
      padding: '0',
      color: 'inherit',
    },
    '& .ol-cm-toolbar-menu': {
      width: '120px',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      fontSize: '14px',
    },
    '& .ol-cm-toolbar-menu-item': {
      border: 'none',
      background: 'none',
      padding: '4px 12px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      fontWeight: 'bold',
      color: 'inherit',
      '&.ol-cm-toolbar-menu-item-active': {
        backgroundColor: 'rgba(125, 125, 125, 0.1)',
      },
      '&:hover': {
        backgroundColor: 'rgba(125, 125, 125, 0.2)',
        color: 'inherit',
      },
      '&.section-level-section': {
        fontSize: '1.44em',
      },
      '&.section-level-subsection': {
        fontSize: '1.2em',
      },
      '&.section-level-body': {
        fontWeight: 'normal',
      },
    },
  },
  '&.overall-theme-dark .ol-cm-toolbar-table-grid': {
    '& td.active': {
      outlineColor: 'white',
      background: 'rgb(125, 125, 125)',
    },
  },
  '.ol-cm-toolbar-table-grid': {
    borderCollapse: 'separate',
    tableLayout: 'fixed',
    fontSize: '6px',
    cursor: 'pointer',
    width: '160px',
    '& td': {
      outline: '1px solid #E7E9EE',
      outlineOffset: '-2px',
      width: '16px',
      height: '16px',

      '&.active': {
        outlineColor: '#3265B2',
        background: '#F1F4F9',
      },
    },
  },
  '.ol-cm-toolbar-table-size-label': {
    maxWidth: '160px',
    fontFamily: 'Lato, sans-serif',
    fontSize: '12px',
  },
  '.ol-cm-toolbar-table-grid-popover': {
    maxWidth: 'unset',
    padding: '8px',
    boxShadow: '0 5px 10px rgba(0, 0, 0, 0.2)',
    borderRadius: '4px',
    backgroundColor: 'var(--editor-toolbar-bg)',
    pointerEvents: 'all',
    color: 'var(--toolbar-btn-color)',
  },
  '.ol-cm-toolbar-button-menu-popover-unstyled': {
    maxWidth: 'unset',
    background: 'transparent',
    border: 0,
    padding: '0 8px 8px 160px',
    boxShadow: 'none',
    pointerEvents: 'none',
  },
})

/**
 * A panel which contains the editor toolbar, provided by a state field which allows the toolbar to be toggled,
 * and styles for the toolbar.
 */
export const toolbarPanel = () => [toolbarState, toolbarTheme]
