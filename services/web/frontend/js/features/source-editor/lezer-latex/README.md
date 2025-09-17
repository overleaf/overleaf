# Lezer-LaTeX, a LaTeX Parser

Lezer-LaTeX is a LaTeX parser implemented with [lezer](https://lezer.codemirror.net/), the parser system used by [CodeMirror 6](https://codemirror.net/6/).

The parser is written in a "grammar" file, (and a "tokens" file with custom tokenizer logic) which is then compiled by `@lezer/generator` into a parser module and a "terms" module. The parser module is then loaded by the CodeMirror 6 in the web frontend codebase.


## Important files

- Source files:
  - `./latex.grammar`: The grammar file, containing the specification for the parser
  - `./tokens.mjs`: The custom tokenizer logic, required by some rules in the grammar

- Generated files:
  - `./latex.mjs`: The generated parser
  - `./latex.terms.mjs`: The generated terms file
  - (these files are ignored by git, eslint, and prettier)

- Scripts:
  - `web/scripts/lezer-latex/generate.js`: A script which runs the generator on the grammar, producing the generated parser/terms files
  - `web/scripts/lezer-latex/run.mjs`: A script that runs the parser against a supplied file, and prints the tree to the terminal

- Webpack plugins:
  - `web/webpack-plugins/lezer-grammar-compiler.js`: A webpack plugin that calls the generator as part of the webpack build. In dev, it will automatically re-build the parser when the grammar file changes.


## NPM tasks

- `lezer-latex:generate`: Generate the parser files from the grammar
  - (Calls `lezer-latex/generate.js`)
  - This should be run whenever the grammar changes

- `lezer-latex:run`: Run the parser against a file
  - (Calls `lezer-latex/run.js`)


### Generating the parser

From the monorepo root:

```sh
# automatic (on changes)
make install

# manually
bin/npm -w services/web run 'lezer-latex:generate'
```


## Tests

Unit tests for the parser live in `web/test/unit/src/LezerLatex`. There are three kinds of test, in three subdirectories:

- `corpus/`: A set of tests using lezer's test framework, consisting of example text and the expected parse tree
- `examples/`: A set of realistic LaTeX documents. These tests pass if the files parse with no errors
- `regressions/`: Like `examples/`, these are expected to parse without error, but they are not realistic documents.

These tests run as part of `test_frontend`. You can run these tests alone by invoking:

``` sh
make test_unit MOCHA_GREP='lezer-latex'
```


## Trying the parser

While developing the parser, you can run it against a file by calling the `lezer-latex:run` task. There are
some example files in the test suite, at `web/test/unit/src/LezerLatex/examples/`.

For example:

``` sh
bin/npm -w services/web run 'lezer-latex:run'  web/test/unit/src/LezerLatex/examples/amsmath.tex
```

If you omit the file path, the default file (`examples/demo.tex`) will be run.


## Integration into web

The web frontend imports the parser (from `latex.mjs`), in `frontend/js/features/source-editor/languages/latex/index.ts`.
The parser is then plugged in to the CM6 language system.

### The web build

In `web/Dockerfile`, we have a `RUN` command that calls `lezer-latex:generate` as part of the build. This is necessary to ensure the parser is built before the CI tests run (notably: we can't do the build during the tests, because we can't write to disk during that stage of CI).
