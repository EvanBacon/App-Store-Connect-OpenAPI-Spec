import { appendFileSync } from "fs";
import path from "path";

import { getLatestSpecAsync } from "./getLatestSpecAsync";

export function fileNameForSpec(spec: any) {
  return `specs/${spec.info.version ?? "unversioned"}.json`;
}

function generateDiffSummary(oldSpec: any, newSpec: any): string {
  const oldVersion = oldSpec?.info?.version ?? "unknown";
  const newVersion = newSpec?.info?.version ?? "unknown";

  const oldPaths = Object.keys(oldSpec?.paths ?? {});
  const newPaths = Object.keys(newSpec?.paths ?? {});
  const addedPaths = newPaths.filter((p) => !oldPaths.includes(p));
  const removedPaths = oldPaths.filter((p) => !newPaths.includes(p));

  const oldSchemas = Object.keys(oldSpec?.components?.schemas ?? {});
  const newSchemas = Object.keys(newSpec?.components?.schemas ?? {});
  const addedSchemas = newSchemas.filter((s) => !oldSchemas.includes(s));
  const removedSchemas = oldSchemas.filter((s) => !newSchemas.includes(s));

  const lines: string[] = [
    `**Version:** ${oldVersion} → ${newVersion}`,
    "",
    `| | Added | Removed | Total |`,
    `|---|---|---|---|`,
    `| Endpoints | ${addedPaths.length} | ${removedPaths.length} | ${newPaths.length} |`,
    `| Schemas | ${addedSchemas.length} | ${removedSchemas.length} | ${newSchemas.length} |`,
  ];

  if (addedPaths.length > 0 && addedPaths.length <= 20) {
    lines.push("", "**New endpoints:**");
    addedPaths.forEach((p) => lines.push(`- \`${p}\``));
  }
  if (removedPaths.length > 0 && removedPaths.length <= 20) {
    lines.push("", "**Removed endpoints:**");
    removedPaths.forEach((p) => lines.push(`- \`${p}\``));
  }

  return lines.join("\n");
}

function setOutput(name: string, value: string) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

async function run() {
  const rootFolder = path.join(import.meta.dir, "../");
  const latestSpecPath = path.join(rootFolder, "specs/latest.json");

  // Read existing spec version for comparison
  let oldSpec: any = null;
  try {
    oldSpec = await Bun.file(latestSpecPath).json();
  } catch {
    console.log("No existing spec found, will create fresh.");
  }

  const spec = await getLatestSpecAsync();
  const apiVersion = spec.info.version;
  console.log("API:", apiVersion);

  // Early exit if version is unchanged
  if (oldSpec?.info?.version === apiVersion) {
    console.log(`Version ${apiVersion} is already current. No update needed.`);
    setOutput("has_update", "false");
    return;
  }

  console.log(
    `New version detected: ${oldSpec?.info?.version ?? "none"} → ${apiVersion}`
  );
  setOutput("has_update", "true");

  const contents = JSON.stringify(spec, null, 2);

  // Write version file for CI
  if (process.env.CI) {
    await Bun.write("apple-api-version.txt", apiVersion);
  }

  // Generate and write diff summary
  if (oldSpec) {
    const summary = generateDiffSummary(oldSpec, spec);
    console.log("\nDiff summary:\n" + summary);
    if (process.env.CI) {
      await Bun.write("diff-summary.md", summary);
    }
  }

  // Write spec files
  const filePath = path.join(rootFolder, fileNameForSpec(spec));
  console.log("Writing to:", filePath);
  await Promise.all([
    Bun.write(filePath, contents),
    Bun.write(latestSpecPath, contents),
  ]);
}

run();
