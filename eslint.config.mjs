import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Matches raw colour values: #abc, #aabbcc, #aabbccdd, rgb(), hsl(), oklch(), ...
const RAW_COLOUR =
  "(?<![\\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\\w-])|\\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\\(";
const RAW_COLOUR_MESSAGE =
  "Don't hardcode colours. Use a theme token class (bg-primary, text-muted-foreground, bg-chart-3) or tokenVar(). Colour values belong in src/theme/presets/.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `const { id, ...rest } = row` is a normal way to drop fields.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Brand rule: no raw colours anywhere in the app except the theme preset files.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/theme/presets/**", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${RAW_COLOUR}/]`, message: RAW_COLOUR_MESSAGE },
        { selector: `TemplateElement[value.raw=/${RAW_COLOUR}/]`, message: RAW_COLOUR_MESSAGE },
      ],
    },
  },
  // Turn off style rules that Prettier handles. Keep this last.
  prettier,
  globalIgnores([
    ".next/**",
    ".next-e2e/**",
    ".next-preview/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
