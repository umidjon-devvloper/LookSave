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
      /*
       * Claude sessiyalari vaqtinchalik git worktree yaratadi
       * (`.claude/worktrees/`). Ular loyiha kodi emas — boshqa tarmoqning
       * nusxasi — lekin repo ichida yotgani uchun lintga tushib, `npm run
       * check` ni yiqitib turardi. `.git/info/exclude` da bo'lgani bilan
       * eslint uni bilmaydi.
       */
      '**/.claude/worktrees/**',
      /*
       * React Router marshrut tiplarini O'ZI yasaydi (`.react-router/types`).
       * Ular `.gitignore` da, lekin lintga tushib turardi va 130 ta
       * «xato» berardi — hech biri tuzatib bo'ladigan emas, chunki fayllar
       * har `react-router typegen` da qaytadan yoziladi. Shu sabab butun
       * `npm run check` yiqilib turardi.
       */
      '**/.react-router/**',
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
      // `fetch` — Node 18+ da global; smoke skriptlari shundan foydalanadi
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
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

  {
    // Buyruq satri vositalari — `apps/<ilova>/scripts/` ichidagi TS fayllar.
    // Ular natijani AYNAN terminalga chiqaradi, ya'ni `console.log` ularning
    // ishi. Ilova kodida qoida kuchida qoladi: u yerda `logger` ishlatiladi.
    //
    // ⚠️ BU BLOK ENG OXIRIDA TURISHI SHART. Flat config'da keyingi mos blok
    // yutadi — umumiy TS bloki bundan oldin tursa, u `no-console` ni
    // qaytadan yoqib qo'yadi.
    files: ['apps/*/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
