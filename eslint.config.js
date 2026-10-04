import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  { files: ['**/*.{js,jsx}'], extends: [js.configs.recommended], languageOptions: { globals: { ...globals.browser, ...globals.serviceworker }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn', 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }], 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }] } },
  { files: ['server/**/*.js', 'api/**/*.js', 'tests/**/*.js', '*.config.js'], languageOptions: { globals: globals.node } },
])
