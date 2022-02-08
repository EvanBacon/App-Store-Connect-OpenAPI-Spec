#!/usr/bin/env ts-node
// import assert from "assert";
import fs from "fs-extra";
import path from "path";

import { getLatestSpecAsync } from "./getLatestSpecAsync";

export function fileNameForSpec(spec: any) {
  return `specs/${spec.info.version ?? "unversioned"}.json`;
}

async function run() {
  const spec = await getLatestSpecAsync();

  const apiVersion = spec.info.version;

  process.env.APPLE_API_VERSION = apiVersion;
  console.log("API:", apiVersion);

  const rootFolder = path.join(__dirname, "../");
  const contents = JSON.stringify(spec, null, 2);

  const filePath = path.join(rootFolder, fileNameForSpec(spec));
  console.log("Writing to:", filePath);
  await Promise.all([
    fs.writeFile(filePath, contents),
    fs.writeFile(path.join(rootFolder, "specs/latest.json"), contents),
  ]);
}

// open pull request with new file

run();
