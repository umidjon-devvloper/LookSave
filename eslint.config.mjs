import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      'docs/**',
      'assets-3d/**',
      'infra/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Metro va Babel konfiglari — CommonJS, Node muhitida ishlaydi.
    // Ular Expo talabi, ESM ga o'tkazib bo'lmaydi.
    files: ['**/metro.config.js', '**/babel.config.js'],
    languageOptions: {
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // Mobil ilovadagi to'plamga kiritilgan aktivlar (GLB, rasm, shrift).
    //
    // Metro ularni FAQAT literal `require('./x.glb')` orqali topadi: yo'l
    // build paytida statik tahlil qilinadi va faylga raqamli id beriladi.
    // `import` bu yerda ishlamaydi — Metro uni modul deb qaraydi va GLB ni
    // JavaScript sifatida parse qilishga urinadi.
    //
    // Ya'ni bu qoidani buzish emas, platforma talabi. Faqat mobil ilovaga
    // tegishli — API va panellarda qoida kuchida qoladi.
    files: ['apps/mobile/**/*.ts', 'apps/mobile/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // Yig'ish skriptlari — Node muhitida yuguradi, brauzerda emas
    files: ['**/scripts/*.mjs', '**/*.config.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // 00-README §7: hech qayerda `any`
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
);
