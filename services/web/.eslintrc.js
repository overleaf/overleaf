module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'standard',
    'prettier',
  ],
  plugins: ['@overleaf'],
  env: {
    es2020: true,
  },
  settings: {
    // Tell eslint-plugin-react to detect which version of React we are using
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-constant-binary-expression': 'error',

    // do not allow importing of implicit dependencies.
    'import/no-extraneous-dependencies': 'error',

    '@overleaf/prefer-kebab-url': 'error',

    // disable some TypeScript rules
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',

    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false, classes: false, variables: false },
    ],
  },
  overrides: [
    // NOTE: changing paths may require updating them in the Makefile too.
    {
      // Node
      files: [
        '**/app/src/**/*.{js,mjs}',
        'app.{js,mjs}',
        'i18next-scanner.config.js',
        'scripts/**/*.{js,mjs}',
        'webpack.config*.js',
      ],
      env: {
        node: true,
      },
    },
    {
      // Test specific rules
      files: ['**/test/**/*.*'],
      plugins: ['mocha', 'chai-expect', 'chai-friendly'],
      env: {
        mocha: true,
      },
      rules: {
        // mocha-specific rules
        'mocha/handle-done-callback': 'error',
        'mocha/no-exclusive-tests': 'error',
        'mocha/no-global-tests': 'error',
        'mocha/no-identical-title': 'error',
        'mocha/no-nested-tests': 'error',
        'mocha/no-pending-tests': 'error',
        'mocha/no-skipped-tests': 'error',
        'mocha/no-mocha-arrows': 'error',

        // Swap the no-unused-expressions rule with a more chai-friendly one
        'no-unused-expressions': 'off',
        'chai-friendly/no-unused-expressions': 'error',

        // chai-specific rules
        'chai-expect/missing-assertion': 'error',
        'chai-expect/terminating-properties': 'error',

        // prefer-arrow-callback applies to all callbacks, not just ones in mocha tests.
        // we don't enforce this at the top-level - just in tests to manage `this` scope
        // based on mocha's context mechanism
        'mocha/prefer-arrow-callback': 'error',

        '@typescript-eslint/no-unused-expressions': 'off',
      },
    },
    {
      // ES specific rules
      files: [
        '**/app/src/**/*.mjs',
        'modules/*/index.mjs',
        'app.mjs',
        'scripts/**/*.mjs',
        'migrations/**/*.mjs',
      ],
      excludedFiles: [
        // migration template file
        'migrations/lib/template.mjs',
      ],
      parserOptions: {
        sourceType: 'module',
      },
      plugins: ['unicorn'],
      rules: {
        'import/no-unresolved': 'error',
        'import/extensions': [
          'error',
          'ignorePackages',
          {
            js: 'always',
            mjs: 'always',
          },
        ],
        'unicorn/prefer-module': 'error',
        'unicorn/prefer-node-protocol': 'error',
      },
    },
    {
      // Backend specific rules
      files: ['**/app/src/**/*.{js,mjs}', 'app.{js,mjs}'],
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.backend.json',
      },
      rules: {
        // do not allow importing of implicit dependencies.
        'import/no-extraneous-dependencies': [
          'error',
          {
            // do not allow importing of devDependencies.
            devDependencies: false,
          },
        ],
        'no-restricted-syntax': [
          'error',
          // do not allow node-fetch in backend code
          {
            selector:
              "CallExpression[callee.name='require'] > .arguments[value='node-fetch']",
            message:
              'Requiring node-fetch is not allowed in production services, please use fetch-utils.',
          },
          // mongoose populate must set fields to populate
          {
            selector:
              "CallExpression[callee.property.name='populate'][arguments.length<2]",
            message:
              "Populate without a second argument returns the whole document. Use populate('field',['prop1','prop2']) instead",
          },
          // Require `new` when constructing ObjectId (For mongo + mongoose upgrade)
          {
            selector:
              "CallExpression[callee.name='ObjectId'], CallExpression[callee.property.name='ObjectId']",
            message:
              'Construct ObjectId with `new ObjectId()` instead of `ObjectId()`',
          },
          // Require `new` when mapping a list of ids to a list of ObjectId (For mongo + mongoose upgrade)
          {
            selector:
              "CallExpression[callee.property.name='map'] Identifier[name='ObjectId']:first-child, CallExpression[callee.property.name='map'] MemberExpression[property.name='ObjectId']:first-child",
            message:
              "Don't map ObjectId directly. Use `id => new ObjectId(id)` instead",
          },
          // Catch incorrect usage of `await db.collection.find()`
          {
            selector:
              "AwaitExpression > CallExpression > MemberExpression[property.name='find'][object.object.name='db']",
            message:
              'Mongo find returns a cursor not a promise, use `for await (const result of cursor)` or `.toArray()` instead.',
          },
        ],
        '@typescript-eslint/no-floating-promises': [
          'error',
          { checkThenables: true },
        ],
      },
    },
    {
      // Backend scripts specific rules
      files: ['**/scripts/**/*.js'],
      rules: {
        'no-restricted-syntax': [
          'error',
          // Require `new` when constructing ObjectId (For mongo + mongoose upgrade)
          {
            selector:
              "CallExpression[callee.name='ObjectId'], CallExpression[callee.property.name='ObjectId']",
            message:
              'Construct ObjectId with `new ObjectId()` instead of `ObjectId()`',
          },
          // Require `new` when mapping a list of ids to a list of ObjectId (For mongo + mongoose upgrade)
          {
            selector:
              "CallExpression[callee.property.name='map'] Identifier[name='ObjectId']:first-child, CallExpression[callee.property.name='map'] MemberExpression[property.name='ObjectId']:first-child",
            message:
              "Don't map ObjectId directly. Use `id => new ObjectId(id)` instead",
          },
          // Catch incorrect usage of `await db.collection.find()`
          {
            selector:
              "AwaitExpression > CallExpression > MemberExpression[property.name='find'][object.object.name='db']",
            message:
              'Mongo find returns a cursor not a promise, use `for await (const result of cursor)` or `.toArray()` instead.',
          },
        ],
      },
    },
    {
      // Cypress specific rules
      files: [
        'cypress/**/*.{js,jsx,ts,tsx}',
        '**/test/frontend/**/*.spec.{js,jsx,ts,tsx}',
      ],
      extends: ['plugin:cypress/recommended'],
    },
    {
      // Frontend test specific rules
      files: ['**/frontend/**/*.test.{js,jsx,ts,tsx}'],
      plugins: ['testing-library'],
      extends: ['plugin:testing-library/react'],
      rules: {
        'testing-library/no-await-sync-events': 'off',
        'testing-library/no-await-sync-queries': 'off',
        'testing-library/no-container': 'off',
        'testing-library/no-node-access': 'off',
        'testing-library/no-render-in-lifecycle': 'off',
        'testing-library/no-wait-for-multiple-assertions': 'off',
        'testing-library/no-wait-for-side-effects': 'off',
        'testing-library/prefer-query-by-disappearance': 'off',
        'testing-library/prefer-screen-queries': 'off',
        'testing-library/render-result-naming-convention': 'off',
      },
    },
    {
      // Frontend specific rules
      files: [
        '**/frontend/js/**/*.{js,jsx,ts,tsx}',
        '**/frontend/stories/**/*.{js,jsx,ts,tsx}',
        '**/*.stories.{js,jsx,ts,tsx}',
        '**/test/frontend/**/*.{js,jsx,ts,tsx}',
        '**/test/frontend/components/**/*.spec.{js,jsx,ts,tsx}',
      ],
      env: {
        browser: true,
      },
      parserOptions: {
        sourceType: 'module',
      },
      plugins: ['jsx-a11y'],
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'standard-jsx',
        'prettier',
      ],
      globals: {
        __webpack_public_path__: true,
        $: true,
        ga: true,
      },
      rules: {
        // TODO: remove once https://github.com/standard/eslint-config-standard-react/issues/68 (support eslint@8) is fixed.
        // START: inline standard-react rules
        // "react/jsx-no-bind": ["error", {
        //   "allowArrowFunctions": true,
        //   "allowBind": false,
        //   "ignoreRefs": true
        // },],
        'react/no-did-update-set-state': 'error',
        'react/no-unused-prop-types': 'error',
        'react/prop-types': 'error',
        // "react/react-in-jsx-scope": "error",
        // END: inline standard-react rules

        'react/no-unknown-property': [
          'error',
          {
            ignore: ['dnd-container', 'dropdown-toggle'],
          },
        ],

        'react/jsx-no-target-blank': [
          'error',
          {
            allowReferrer: true,
          },
        ],
        // Prevent usage of legacy string refs
        'react/no-string-refs': 'error',

        // Prevent curly braces around strings (as they're unnecessary)
        'react/jsx-curly-brace-presence': [
          'error',
          {
            props: 'never',
            children: 'never',
          },
        ],

        // Don't import React for JSX; the JSX runtime is added by a Babel plugin
        'react/react-in-jsx-scope': 'off',
        'react/jsx-uses-react': 'off',

        // Allow functions as JSX props
        'react/jsx-no-bind': 'off', // TODO: fix occurrences and re-enable this

        // Fix conflict between prettier & standard by overriding to prefer
        // double quotes
        'jsx-quotes': ['error', 'prefer-double'],

        // Override weird behaviour of jsx-a11y label-has-for (says labels must be
        // nested *and* have for/id attributes)
        'jsx-a11y/label-has-for': [
          'error',
          {
            required: {
              some: ['nesting', 'id'],
            },
          },
        ],

        // Require .jsx or .tsx file extension when using JSX
        'react/jsx-filename-extension': [
          'error',
          {
            extensions: ['.jsx', '.tsx'],
          },
        ],
        'no-restricted-syntax': [
          'error',
          // prohibit direct calls to methods of window.localStorage
          {
            selector:
              "CallExpression[callee.object.object.name='window'][callee.object.property.name='localStorage']",
            message:
              'Modify location via customLocalStorage instead of calling window.localStorage methods directly',
          },
        ],
      },
    },
    {
      // Sorting for Meta
      files: ['frontend/js/utils/meta.ts'],
      rules: {
        '@typescript-eslint/member-ordering': [
          'error',
          { interfaces: { order: 'alphabetically' } },
        ],
      },
    },
    {
      // React component specific rules
      //
      files: [
        '**/frontend/js/**/components/**/*.{js,jsx,ts,tsx}',
        '**/frontend/js/**/hooks/**/*.{js,jsx,ts,tsx}',
      ],
      rules: {
        '@overleaf/no-unnecessary-trans': 'error',
        '@overleaf/should-unescape-trans': 'error',

        // https://astexplorer.net/
        'no-restricted-syntax': [
          'error',
          // prohibit direct calls to methods of window.location
          {
            selector:
              "CallExpression[callee.object.object.name='window'][callee.object.property.name='location']",
            message:
              'Modify location via useLocation instead of calling window.location methods directly',
          },
          // prohibit assignment to window.location
          {
            selector:
              "AssignmentExpression[left.object.name='window'][left.property.name='location']",
            message:
              'Modify location via useLocation instead of calling window.location methods directly',
          },
          // prohibit assignment to window.location.href
          {
            selector:
              "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']",
            message:
              'Modify location via useLocation instead of calling window.location methods directly',
          },
          // prohibit using lookbehinds due to incidents with Safari simply crashing when the script is parsed
          {
            selector: 'Literal[regex.pattern=/\\(\\?<[!=]/]',
            message: 'Lookbehind is not supported in older Safari versions.',
          },
          // prohibit direct calls to methods of window.localStorage
          // NOTE: this rule is also defined for all frontend files, but those rules are overriden by the React component-specific config
          {
            selector:
              "CallExpression[callee.object.object.name='window'][callee.object.property.name='localStorage']",
            message:
              'Modify location via customLocalStorage instead of calling window.localStorage methods directly',
          },
        ],
      },
    },
    // React + TypeScript-specific rules
    {
      files: ['**/*.tsx'],
      rules: {
        'react/prop-types': 'off',
        'no-undef': 'off',
      },
    },
    // TypeScript-specific rules
    {
      files: ['**/*.ts'],
      rules: {
        'no-undef': 'off',
      },
    },
    // JavaScript-specific rules
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['scripts/ukamf/*.js'],
      rules: {
        // Do not allow importing of any dependencies unless specified in either
        //  - web/package.json
        //  - web/scripts/ukamf/package.json
        'import/no-extraneous-dependencies': [
          'error',
          { packageDir: ['.', 'scripts/ukamf'] },
        ],
      },
    },
    {
      files: ['scripts/learn/checkSanitize/*.js'],
      rules: {
        // The checkSanitize script is used in the dev-env only.
        'import/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: true,
            packageDir: ['.', '../../'],
          },
        ],
      },
    },
    {
      files: [
        // Backend: Use @overleaf/logger
        //          Docs: https://manual.dev-overleaf.com/development/code/logging/#structured-logging
        '**/app/**/*.{js,cjs,mjs}',
        'app.{js,mjs}',
        'modules/*/*.{js,mjs}',
        // Frontend: Prefer debugConsole over bare console
        //           Docs: https://manual.dev-overleaf.com/development/code/logging/#frontend
        '**/frontend/**/*.{js,jsx,ts,tsx}',
        // Tests
        '**/test/**/*.{js,cjs,mjs,jsx,ts,tsx}',
      ],
      excludedFiles: [
        // Allow console logs in scripts
        '**/scripts/**/*.js',
        // Allow console logs in stories
        '**/stories/**/*.{js,jsx,ts,tsx}',
        // Workers do not have access to the search params for enabling ?debug=true.
        // self.location.url is the URL of the worker script.
        '*.worker.{js,ts}',
      ],
      rules: {
        'no-console': 'error',
      },
    },
  ],
}
