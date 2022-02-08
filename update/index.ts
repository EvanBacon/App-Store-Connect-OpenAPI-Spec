#!/usr/bin/env ts-node
import assert from "assert";
import fs from "fs-extra";
import path from "path";

import { getLatestSpecAsync } from "./getLatestSpecAsync";
import {
  fileNameForSpec,
  openPullRequestIfSpecDoesNotExistAsync,
} from "./github";

const isCI = process.env.CI === "true";

async function run() {
  const spec = await getLatestSpecAsync();

  const apiVersion = spec.info.version;

  console.log("API:", apiVersion);

  if (isCI) {
    await openPullRequestIfSpecDoesNotExistAsync(spec);
  } else {
    const rootFolder = path.join(__dirname, "../");
    const contents = JSON.stringify(spec, null, 2);

    await Promise.all([
      fs.writeFile(path.join(rootFolder, fileNameForSpec(spec)), contents),
      fs.writeFile(path.join(rootFolder, "specs/latest.json"), contents),
    ]);
  }
}

// open pull request with new file

run();
