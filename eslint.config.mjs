import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Dossiers de public/ : une adresse écrite en dur vers eux casse sous le préfixe /Portfolio
// de GitHub Pages. Elle doit passer par asset() (src/lib/asset.ts).
const PUBLIC_PATH = "/^\\/(models|audio|textures|projects|fonts|images)\\//";
const PUBLIC_PATH_MESSAGE =
  "Adresse de public/ écrite en dur : l'envelopper dans asset() (src/lib/asset.ts), sans quoi elle casse sur GitHub Pages.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    // Les données gardent des chemins bruts : ceux qui les affichent les passent à asset().
    ignores: ["src/data/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${PUBLIC_PATH}]:not(CallExpression[callee.name='asset'] > Literal)`,
          message: PUBLIC_PATH_MESSAGE,
        },
        {
          selector: `TemplateLiteral:not(CallExpression[callee.name='asset'] > TemplateLiteral) > TemplateElement[value.raw=${PUBLIC_PATH}]`,
          message: PUBLIC_PATH_MESSAGE,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
