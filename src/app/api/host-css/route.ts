import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

export async function GET() {
  // adjust the path if you use a src/ directory
  const file = path.join(process.cwd(), "src", "app", "globals.css");
  const css = await readFile(file, "utf8");
  return new Response(css, {
    headers: { "Content-Type": "text/css; charset=utf-8" },
  });
}
