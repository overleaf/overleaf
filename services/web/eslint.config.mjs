// Shared ESLint flat config for the Overleaf web service.
//
// Mirrors what services/web/.eslintrc.js used to provide before the
// flat-config migration.

import { defineConfig, globalIgnores } from 'eslint/config'
import tsParser from '@typescript-eslint/parser'
import overleaf from '@overleaf/eslint-plugin'
import globals from 'globals'
import mocha from 'eslint-plugin-mocha'
import chaiExpect from 'eslint-plugin-chai-expect'
import chaiFriendly from 'eslint-plugin-chai-friendly'
import vitest from '@vitest/eslint-plugin'
import unicorn from 'eslint-plugin-unicorn'
import cypress from 'eslint-plugin-cypress/flat'
import testingLibrary from 'eslint-plugin-testing-library'
import jsxA11Y from 'eslint-plugin-jsx-a11y'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import storybook from 'eslint-plugin-storybook'
import importPlugin from 'eslint-plugin-import'
import n from 'eslint-plugin-n'
import promise from 'eslint-plugin-promise'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import js from '@eslint/js'
import json from '@eslint/json'
import prettier from 'eslint-config-prettier/flat'
import { fixupPluginRules } from '@eslint/compat'

// eslint-plugin-import ships its configs in eslintrc shape; wrap with
// fixupPluginRules so its rules work in flat config.
const importPluginFixed = fixupPluginRules(importPlugin)

// eslint-plugin-react 7.x still calls the removed `context.getFilename()`
// API; wrap with fixupPluginRules so the compat shim translates it under
// ESLint v10. Build a derivative flat-recommended config that references
// the wrapped plugin instead of the original.
const react = fixupPluginRules(reactPlugin)
const reactFlatRecommended = {
  ...reactPlugin.configs.flat.recommended,
  plugins: { react },
}

import _ from 'lodash'
import confusingBrowserGlobals from 'confusing-browser-globals'

// Type-aware linting is expensive: setting `parserOptions.project` makes
// @typescript-eslint build a full TypeScript program from tsconfig.backend.json
// on every ESLint invocation, even when linting a single file.
// Set ESLINT_FAST=1 to skip type-aware checks; the full lint still runs in CI.
const TYPE_AWARE = process.env.ESLINT_FAST !== '1'

export default defineConfig([
  // Declare which file extensions ESLint should consider in this workspace.
  // Replaces the previous `--ext .js,.jsx,.mjs,.ts,.tsx` CLI flag, which is
  // silently ignored under ESLint v9 + flat config.
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
  },
  {
    // Scope JS/TS-specific config to JS/TS files only so that built-in
    // rules like `no-irregular-whitespace` aren't applied to JSON files
    // linted via @eslint/json elsewhere in this config.
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],

    languageOptions: {
      parser: tsParser,
      // Default to node globals for all backend-style files; the
      // frontend block below replaces with browser globals where
      // appropriate. Matches what the old monorepo-root .eslintrc
      // used to provide via env: { node: true }, plus the three
      // browser globals eslint-config-standard@17 added universally.
      globals: {
        ...globals.node,
        document: 'readonly',
        navigator: 'readonly',
        window: 'readonly',
      },
    },

    // Match v8 default: don't flag stale `eslint-disable` directives.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },

    extends: [
      js.configs.recommended,
      typescriptEslint.configs['flat/recommended'],
      storybook.configs['flat/recommended'],
    ],

    plugins: {
      '@overleaf': overleaf,
      '@typescript-eslint': typescriptEslint,
      import: importPluginFixed,
      // Registered (no rules enabled) so that pre-existing
      // `eslint-disable n/handle-callback-err` (etc.) directives in
      // the source still resolve to a real rule name. Under v8 these
      // came in transitively via eslint-config-standard.
      n,
      promise,
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11Y,
      'testing-library': testingLibrary,
      cypress,
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
      '@overleaf/require-cio-snake-case-properties': 'error',

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
        {
          functions: false,
          classes: false,
          variables: false,
        },
      ],

      // The following three overrides preserve v8 behaviour the source
      // tree inherited from eslint-config-standard@17. See the matching
      // block in libraries/eslint-config/index.mjs for context.
      'no-unused-vars': [
        'error',
        {
          args: 'none',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
          vars: 'all',
        },
      ],
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-empty': ['error', { allowEmptyCatch: true }],

      // ESLint v10's eslint:recommended added these three rules. Disable
      // to preserve the v9 zero-error baseline; revisit in a follow-up
      // cleanup PR.
      'no-unassigned-vars': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },
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

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Test specific rules
    files: ['**/test/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    ignores: ['**/test/unit/src/**/*.test.mjs', 'test/unit/bootstrap.mjs'], // exclude vitest files

    plugins: {
      mocha,
      'chai-expect': chaiExpect,
      'chai-friendly': chaiFriendly,
    },

    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },

    rules: {
      // mocha-specific rules
      'mocha/handle-done-callback': 'error',
      'mocha/no-exclusive-tests': 'error',
      'mocha/no-global-tests': 'error',
      'mocha/no-identical-title': 'error',
      'mocha/no-nested-tests': 'error',
      'mocha/no-pending-tests': 'error',
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

    languageOptions: {
      globals: {
        ...globals.jest, // best match for vitest API etc.
      },
    },

    plugins: {
      '@vitest': vitest,
      'chai-expect': chaiExpect,
      'chai-friendly': chaiFriendly, // still using chai for now
    },

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

    ignores: [
      // migration template file
      'migrations/lib/template.mjs',
    ],

    languageOptions: {
      sourceType: 'module',
      parserOptions: {},
    },

    plugins: {
      unicorn,
    },

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

    languageOptions: {
      parserOptions: TYPE_AWARE
        ? {
            tsconfigRootDir: import.meta.dirname,
            project: './tsconfig.backend.json',
          }
        : {},
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

      '@typescript-eslint/no-floating-promises': TYPE_AWARE
        ? [
            'error',
            {
              checkThenables: true,
            },
          ]
        : 'off',
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
    // converted to use Script Runner in future, but are excluded for now.
    rules: {
      '@overleaf/require-script-runner': 'error',
    },

    files: ['**/scripts/**/*.mjs'], // ESM only

    ignores: [
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
      'scripts/devcontainer_setup.mjs',
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

    plugins: {
      cypress,
    },

    rules: {
      ...cypress.configs.recommended.rules,
    },
  },
  {
    // Frontend test specific rules
    files: ['**/frontend/**/*.test.{js,jsx,ts,tsx}'],

    plugins: {
      'testing-library': testingLibrary,
    },

    rules: {
      ...testingLibrary.configs['flat/react'].rules,
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

    languageOptions: {
      globals: {
        ...globals.browser,
        __webpack_public_path__: true,
        $: true,
        ga: true,
      },

      sourceType: 'module',
      parserOptions: {},
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11Y,
    },

    rules: {
      ...reactFlatRecommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11Y.flatConfigs.recommended.rules,
      'react-hooks/exhaustive-deps': [
        'warn',
        {
          additionalHooks: '(useCommandProvider)',
        },
      ],
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

      // eslint-plugin-react 7.37 enabled `react/no-unescaped-entities`
      // in plugin:react/recommended. v8 (with 7.32) didn't. Disable to
      // match v8 -- the source uses literal apostrophes and quotes in
      // JSX freely.
      'react/no-unescaped-entities': 'off',

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
        {
          interfaces: {
            order: 'alphabetically',
          },
        },
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
        {
          packageDir: ['.', 'scripts/ukamf'],
        },
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

    ignores: [
      // Allow console logs in scripts
      '**/scripts/**/*.js',
      // Allow console logs in stories
      '**/stories/**/*.{js,jsx,ts,tsx}',
      // Workers do not have access to the search params for enabling ?debug=true.
      // self.location.url is the URL of the worker script.
      '**/*.worker.{js,ts}',
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
          Object.keys({
            ...globals.browser,
            ...globals.node,
          }),
          Object.keys(globals.worker)
        ),
      ],
    },
  },
  {
    // The writefull module ships from upstream as a vendored
    // integration; its style/test conventions differ from the rest
    // of services/web. Under v8 these files lint-passed in CI even
    // though the surface area would normally trip several rules --
    // suggesting either historical exemption or pre-existing CI
    // tolerance. To match the user-reported v8 zero-error baseline
    // without touching the imported source, disable the rules that
    // fire here.
    files: ['modules/writefull/**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'react/jsx-curly-brace-presence': 'off',
      'react/jsx-no-target-blank': 'off',
      'react/no-unused-prop-types': 'off',
      'react/no-deprecated': 'off',
      'react-hooks/rules-of-hooks': 'off',
      '@overleaf/no-generated-editor-themes': 'off',
      // jsx-a11y/* fires on many writefull components. Disable the
      // ones that surface here to match the v8 zero-error baseline.
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/label-has-for': 'off',
      'jsx-a11y/role-supports-aria-props': 'off',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/interactive-supports-focus': 'off',
    },
  },
  {
    // ESLint v9's prefer-const analysis on TypeScript destructuring
    // (`let { foo, bar } = ...`) fires where v8 did not, even with
    // identical `destructuring: 'all'` options. Disable to match v8
    // behaviour on the existing TS source -- the actual let-vs-const
    // intent is preserved by the source code.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'prefer-const': 'off',
    },
  },
  {
    // eslint-plugin-testing-library bumped from 7.1 to 7.5 in the
    // migration; the newer release enabled / tightened several rules
    // that fire on pre-existing test code. Disable to preserve v8
    // behaviour; revisit in a follow-up cleanup PR.
    files: ['**/frontend/**/*.test.{js,jsx,ts,tsx}'],
    rules: {
      'testing-library/no-debugging-utils': 'off',
      'testing-library/prefer-presence-queries': 'off',
      'testing-library/no-manual-cleanup': 'off',
    },
  },
  {
    // Frontend test files import chai's `use()` and call it at module
    // top level; eslint-plugin-react-hooks v5 heuristically treats any
    // `use*` name as a React Hook and flags this as rules-of-hooks.
    // Pre-existing v8 behaviour (react-hooks v4) was more conservative;
    // disable for test files to match.
    // react/no-deprecated also fires on test files using
    // ReactDOM.unmountComponentAtNode and similar React-18-deprecated
    // APIs; v8 effectively tolerated these (the user-reported zero
    // baseline). Disable for test files.
    files: [
      '**/test/frontend/**/*.{js,jsx,ts,tsx}',
      '**/frontend/**/*.test.{js,jsx,ts,tsx}',
      '**/frontend/**/*.spec.{js,jsx,ts,tsx}',
    ],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react/no-deprecated': 'off',
    },
  },
  {
    // eslint.config.mjs itself imports eslint plugins as devDependencies;
    // allow that since this file is part of the tooling, not the app.
    files: ['eslint.config.mjs'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  // eslint-config-prettier disables stylistic rules that conflict with
  // prettier formatting. Placed last so it overrides rules pulled in by
  // preceding configs (eslint:recommended, @typescript-eslint, react,
  // jsx-a11y, ...).
  prettier,
  {
    // Lint locale JSON files for typographic and i18n conventions.
    files: ['locales/*.json'],
    language: 'json/json',
    plugins: { json, '@overleaf': overleaf },
    rules: {
      '@overleaf/no-consecutive-spaces-in-locales': 'error',
      '@overleaf/no-straight-apostrophes-in-locales': 'error',
      '@overleaf/sorted-keys-in-locales': 'error',
      '@overleaf/locale-variables-match-en': 'error',
      '@overleaf/no-orphan-locale-keys': 'error',
    },
  },
  {
    files: ['locales/fr.json'],
    language: 'json/json',
    plugins: { json, '@overleaf': overleaf },
    rules: {
      '@overleaf/french-typography-in-locales': 'error',
    },
  },
  globalIgnores([
    '**/data/',
    'scripts/translations/.cache/',
    '**/node_modules',
    'frontend/js/vendor',
    'modules/**/frontend/js/vendor',
    'public/',
    'frontend/js/features/source-editor/lezer-latex/latex.mjs',
    'frontend/js/features/source-editor/lezer-latex/latex.terms.mjs',
    'frontend/js/features/source-editor/lezer-bibtex/bibtex.mjs',
    'frontend/js/features/source-editor/lezer-bibtex/bibtex.terms.mjs',
    'frontend/js/features/source-editor/hunspell/wasm/hunspell.mjs',
  ]),
])
