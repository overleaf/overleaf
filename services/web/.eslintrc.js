const _ = require('lodash')
const confusingBrowserGlobals = require('confusing-browser-globals')
const globals = require('globals')

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
    'no-restricted-globals': ['error', ...confusingBrowserGlobals],

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
    'react-hooks/exhaustive-deps': [
      'warn',
      {
        additionalHooks: '(useCommandProvider)',
      },
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
      excludedFiles: [
        '**/test/unit/src/**/*.test.mjs',
        'test/unit/bootstrap.mjs',
      ], // exclude vitest files
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
      files: ['**/test/unit/src/**/*.test.mjs', 'test/unit/bootstrap.mjs'],
      env: {
        jest: true, // best match for vitest API etc.
      },
      plugins: ['@vitest', 'chai-expect', 'chai-friendly'], // still using chai for now
      rules: {
        // vitest-specific rules
        '@vitest/no-focused-tests': 'error',
        '@vitest/no-disabled-tests': 'error',

        // Swap the no-unused-expressions rule with a more chai-friendly one
        'no-unused-expressions': 'off',
        'chai-friendly/no-unused-expressions': 'error',

        // chai-specific rules
        'chai-expect/missing-assertion': 'error',
        'chai-expect/terminating-properties': 'error',
        '@typescript-eslint/no-unused-expressions': 'off',
        '@overleaf/require-vi-doMock-valid-path': 'error',
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
        '**/test/acceptance/src/**/*.mjs',
        '**/test/unit/src/**/*.mjs',
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
        'import/no-unresolved': [
          'error',
          {
            // eslint-plugin-import does not support exports directive in package.json
            // https://github.com/import-js/eslint-plugin-import/issues/1810
            ignore: ['^p-queue$'],
          },
        ],
        'import/named': 'error',
        'import/default': 'error',
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
      files: ['**/scripts/**/*.{js,mjs}'],
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
      // Insist on using Script Runner for new scripts. Old scripts should be
      // converted to use Script Runner in future, but are excluded for now
      rules: {
        '@overleaf/require-script-runner': 'error',
      },
      files: ['**/scripts/**/*.mjs'], // ESM only
      excludedFiles: [
        'modules/admin-roles/scripts/import_admin_role_assignments.mjs',
        'modules/admin-roles/scripts/remove_admin_role_from_user.mjs',
        'modules/admin-roles/scripts/remove_admin_roles_from_non_admins.mjs',
        'modules/admin-roles/scripts/utils.mjs',
        'modules/institutions/scripts/apply_policy_to_institution.mjs',
        'modules/server-ce-scripts/scripts/change-compile-timeout.mjs',
        'modules/server-ce-scripts/scripts/check-mongodb.mjs',
        'modules/server-ce-scripts/scripts/check-redis.mjs',
        'modules/server-ce-scripts/scripts/check-texlive-images.mjs',
        'modules/server-ce-scripts/scripts/create-user.mjs',
        'modules/server-ce-scripts/scripts/delete-user.mjs',
        'modules/server-ce-scripts/scripts/export-user-projects.mjs',
        'modules/server-ce-scripts/scripts/migrate-user-emails.mjs',
        'modules/server-ce-scripts/scripts/rename-tag.mjs',
        'modules/server-ce-scripts/scripts/transfer-all-projects-to-user.mjs',
        'modules/server-ce-scripts/scripts/upgrade-user-features.mjs',
        'modules/subscriptions/scripts/backfill_user_last_trial.mjs',
        'scripts/add_feature_override.mjs',
        'scripts/add_subscription_members_csv.mjs',
        'scripts/analytics/helpers/GoogleBigQueryHelper.mjs',
        'scripts/attach_dangling_comments_to_doc.mjs',
        'scripts/backfill_mixpanel_user_properties.mjs',
        'scripts/backfill_project_image_name.mjs',
        'scripts/backfill_user_properties.mjs',
        'scripts/backfill_users_sso_attribute.mjs',
        'scripts/bench_bcrypt.mjs',
        'scripts/check_institution_users.mjs',
        'scripts/check_overleafModuleImports.mjs',
        'scripts/check_saml_emails.mjs',
        'scripts/clear_feedback_collection.mjs',
        'scripts/clear_sessions_set_must_reconfirm.mjs',
        'scripts/count_files_in_projects.mjs',
        'scripts/count_project_size.mjs',
        'scripts/create_oauth_personal_access_token.mjs',
        'scripts/create_project.mjs',
        'scripts/deactivate_projects.mjs',
        'scripts/delete-duplicate-splittest-versions/delete_test_dupes.mjs',
        'scripts/delete-orphaned-docs/delete-orphaned-docs.mjs',
        'scripts/delete_dangling_comments.mjs',
        'scripts/delete_orphaned_chat_threads.mjs',
        'scripts/delete_orphaned_data_helper.mjs',
        'scripts/delete_subscriptions.mjs',
        'scripts/e2e_test_setup.mjs',
        'scripts/ensure_affiliations.mjs',
        'scripts/esm-check-migration.mjs',
        'scripts/example/script_for_migration.mjs',
        'scripts/fix_collaborator_refs_null.mjs',
        'scripts/fix_comment_id.mjs',
        'scripts/helpers/chunkArray.mjs',
        'scripts/helpers/env_variable_helper.mjs',
        'scripts/inst_table.mjs',
        'scripts/invalidate_tokens.mjs',
        'scripts/ip_matcher_ranges.mjs',
        'scripts/learn/checkSanitize/checkSanitizeOptions.mjs',
        'scripts/learn/checkSanitize/scrape.mjs',
        'scripts/lezer-latex/benchmark.mjs',
        'scripts/lezer-latex/print-tree.mjs',
        'scripts/lezer-latex/random.mjs',
        'scripts/lezer-latex/run.mjs',
        'scripts/lezer-latex/test-incremental-parser.mjs',
        'scripts/mark_migration.mjs',
        'scripts/marketing-exports/error-assistant-export.mjs',
        'scripts/marketing-exports/export.mjs',
        'scripts/marketing-exports/linked-papers-users.mjs',
        'scripts/marketing-exports/papers-export.mjs',
        'scripts/marketing-exports/writefull-export.mjs',
        'scripts/oauth/upgrade_token_scopes.mjs',
        'scripts/plan-prices/plans.mjs',
        'scripts/process_lapsed_reconfirmations.mjs',
        'scripts/purge_non_logged_in_sessions.mjs',
        'scripts/recurly/generate_recurly_prices.mjs',
        'scripts/recurly/get_paypal_accounts_csv.mjs',
        'scripts/recurly/recurly_prices.mjs',
        'scripts/recurly/resync_recurly_state_single_subscription.mjs',
        'scripts/recurly/resync_subscriptions.mjs',
        'scripts/recurly/set_manually_collected_subscriptions.mjs',
        'scripts/refresh_features.mjs',
        'scripts/regenerate_duplicate_referral_ids.mjs',
        'scripts/remove_deleted_users_from_token_access_refs.mjs',
        'scripts/remove_email.mjs',
        'scripts/remove_user_enrollment.mjs',
        'scripts/sso_id_migration_check.mjs',
        'scripts/stress_test.mjs',
        'scripts/suspend_users.mjs',
        'scripts/sync-user-entitlements/sync-user-entitlements.mjs',
        'scripts/update_project_image_name.mjs',
        'scripts/user-export/analytics.mjs',
        'scripts/user-export/fs.mjs',
        'scripts/user-export/http.mjs',
        'scripts/user-export/observer.mjs',
        'scripts/user-export/options.mjs',
        'scripts/user-export/project.mjs',
        'scripts/user-export/scrubber.mjs',
        'scripts/user-export/stream.mjs',
        'scripts/user-export/user.mjs',
        'scripts/validate-data-of-model.mjs',
      ],
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
        '@overleaf/no-generated-editor-themes': 'error',
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
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            ignoreRestSiblings: false,
            caughtErrors: 'none',
            vars: 'all',
            varsIgnorePattern: '^_',
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
        '@overleaf/require-loading-label': 'error',

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
    {
      files: ['**/*.worker.{js,ts}'],
      rules: {
        'no-restricted-globals': [
          'error',
          ..._.difference(
            Object.keys({ ...globals.browser, ...globals.node }),
            Object.keys(globals.worker)
          ),
        ],
      },
    },
  ],
}
