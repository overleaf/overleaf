import { latexLinter } from './linter/latex-linter'
import { lintSourceConfig } from '../../extensions/annotations'
import { createLinter } from '../../extensions/linting'

export const linting = () => createLinter(latexLinter, lintSourceConfig)
