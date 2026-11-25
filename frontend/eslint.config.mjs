import js from '@eslint/js'
import hooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  { ignores: ['dist/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]
