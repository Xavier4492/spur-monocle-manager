// eslint.config.js (nouveau format ESLint 9)
import eslintPluginPrettier from 'eslint-plugin-prettier'
import pluginTs from '@typescript-eslint/eslint-plugin'
import parserTs from '@typescript-eslint/parser'

export default [
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: parserTs,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': pluginTs,
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...pluginTs.configs.recommended.rules,
      'prettier/prettier': 'error',
    },
  },
]
