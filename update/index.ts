#!/usr/bin/env ts-node
import fs from "fs-extra";
import path from "path";

import { getLatestSpecAsync } from "./getLatestSpecAsync";

export function fileNameForSpec(spec: any) {
  return `specs/${spec.info.version ?? "unversioned"}.json`;
}

async function run() {
  const spec = await getLatestSpecAsync();

  const apiVersion = spec.info.version;

  console.log("API:", apiVersion);

  const rootFolder = path.join(__dirname, "../");
  const contents = JSON.stringify(spec, null, 2);

  // Write this to a file in CI so the PR action can use it.
  if (process.env.CI) {
    await fs.writeFile("apple-api-version.txt", apiVersion);
  }

  // Write the files as expected so the PR action can use them.
  const filePath = path.join(rootFolder, fileNameForSpec(spec));
  console.log("Writing to:", filePath);
  await Promise.all([
    fs.writeFile(filePath, contents),
    fs.writeFile(path.join(rootFolder, "specs/latest.json"), contents),
  ]);
}

run();
