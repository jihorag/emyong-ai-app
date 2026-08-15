import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// 주석을 쓰지 않는다.
//
// 코드가 무엇을 하는지는 코드가 말한다. 주석은 코드와 함께 낡고, 낡은 주석은
// 없는 것만 못하다. 이름을 고치거나 함수를 쪼개서 해결할 것.
//
// 예외는 둘뿐이다.
//   ⚠  로 시작하는 경고 — 고치면 조용히 깨지는 자리. 코드로는 표현할 수 없다.
//   eslint 지시어 — 문법이지 설명이 아니다.
const noComments = {
  meta: {
    type: 'suggestion',
    docs: { description: '주석 금지. ⚠ 경고와 eslint 지시어만 허용한다.' },
    schema: [],
  },
  create(context) {
    const allowed = (text) =>
      text.includes('⚠') ||
      /eslint-(disable|enable)|@ts-|\b(global|globals|exported)\b/.test(text)
    return {
      Program() {
        for (const c of context.sourceCode.getAllComments()) {
          if (allowed(c.value)) continue
          context.report({
            loc: c.loc,
            message:
              '주석을 쓰지 않습니다. 이름·구조로 드러내세요. ' +
              '고치면 깨지는 자리라면 ⚠ 로 시작하는 한 줄만 남기세요.',
          })
        }
      },
    }
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: { local: { rules: { 'no-comments': noComments } } },
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'local/no-comments': 'error',

      // ⚠ 빈 catch 를 허용한다. localStorage 쿼터·프라이빗 모드처럼 실패해도
      //   할 일이 없는 자리가 많고, 설명은 주석 금지 규칙에 걸린다.
      'no-empty': ['error', { allowEmptyCatch: true }],

      'react-hooks/set-state-in-effect': 'warn',

      // ⚠ 색은 tokens.js 에서만. 한때 고유 색이 107종까지 늘었다.
      'no-restricted-syntax': ['error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\\b/]',
          message: '색을 직접 쓰지 마세요. src/styles/tokens.js 에서 import 하거나, 없으면 거기에 추가한 뒤 쓰세요.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\\b/]',
          message: '템플릿 문자열 안에도 색을 직접 쓰지 마세요. tokens.js 의 gradient/shadow 를 쓰거나 거기에 추가하세요.',
        },
      ],
    },
  },
  {
    files: ['src/styles/tokens.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['api/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  // ⚠ 앱 밖 도구는 주석을 허용한다. 콘텐츠 출처·실행 순서를 적어 둬야
  //   나중에 이 파일들을 다시 돌릴 수 있다.
  {
    files: ['test/**', 'scripts/**', 'eslint.config.js', 'vite.config.js'],
    rules: { 'local/no-comments': 'off' },
  },
])
