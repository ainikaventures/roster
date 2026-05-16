/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  extends: [
    require.resolve('./eslint-base.js'),
    'next/core-web-vitals',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:tailwindcss/recommended',
    'prettier',
  ],
  settings: {
    react: { version: 'detect' },
    tailwindcss: {
      callees: ['cn', 'clsx', 'cva'],
      config: 'tailwind.config.ts',
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'tailwindcss/no-custom-classname': 'off',
  },
};
