import importOverleafModules from '../macros/import-overleaf-module.macro'

if (process.env.NODE_ENV === 'development') {
  importOverleafModules('devToolbar')
}
