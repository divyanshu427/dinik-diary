// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function rawColourErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax");
}

describe("lint rule: no hardcoded colours", () => {
  it("flags hex colours and colour functions in components", async () => {
    const code = `
      export const a = "bg-[#ff0000]";
      export const b = { color: "#38796C" };
      export const c = \`border-[rgb(0,0,0)]\`;
      export const d = "oklch(0.5 0.1 200)";
    `;
    const errors = await rawColourErrors(code, "src/components/demo.tsx");
    expect(errors).toHaveLength(4);
  });

  it("allows token classes, tokenVar() and lookalike strings", async () => {
    const code = `
      export const a = "bg-primary text-muted-foreground bg-chart-3";
      export const b = "var(--chart-1)";
      export const c = "#add-habit";
      export const d = "hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]";
    `;
    expect(await rawColourErrors(code, "src/features/demo.tsx")).toHaveLength(0);
  });

  it("allows colour values inside theme preset files", async () => {
    const code = `export const x = { primary: "#2F6F62" };`;
    expect(await rawColourErrors(code, "src/theme/presets/demo.ts")).toHaveLength(0);
  });
}, 60_000);
