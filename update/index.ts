#!/usr/bin/env ts-node

import assert from "assert";
import fs from "fs-extra";
import fetch from "node-fetch";
import StreamZip from "node-stream-zip";
import path from "path";
import { Stream } from "stream";
import { promisify } from "util";
import { Octokit } from "@octokit/rest";

const pipeline = promisify(Stream.pipeline);

const isCI = process.env.CI === "true";

function fileNameForSpec(spec: any) {
  return `specs/${spec.info.version ?? "unversioned"}.json`;
}

async function run() {
  const spec = await getLatestSpecAsync();

  const apiVersion = spec.info.version;
  console.log("API:", apiVersion);

  const specsFolder = path.join(__dirname, "../");
  await fs.ensureDir(specsFolder);
  const fileName = path.join(specsFolder, fileNameForSpec(spec));
  const latestFileName = path.join(specsFolder, "latest.json");

  if (isCI) {
    assert(process.env.GITHUB_TOKEN);
    openPullRequestIfSpecDoesNotExistAsync(spec);
  } else {
    await Promise.all([
      fs.writeFile(fileName, JSON.stringify(spec, null, 2)),
      fs.writeFile(latestFileName, JSON.stringify(spec, null, 2)),
    ]);
  }
}

async function openPullRequestIfSpecDoesNotExistAsync(
  spec: any
): Promise<void> {
  const exists = await checkIfSpecExistsAlready(spec);
  if (exists) {
    console.log("Spec already exists, not opening pull request");
    return;
  }
  await openPullRequestAsync(spec);
}

async function checkIfSpecExistsAlready(spec: any): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN not set");
  }
  const octokit = new Octokit({
    auth: `token ${token}`,
  });
  const { data: pullRequests } = await octokit.pulls.list({
    owner: "EvanBacon",
    repo: "App-Store-Connect-OpenAPI-Specification",
    state: "open",
  });
  const pullRequest = pullRequests.find((pr) =>
    pr.title.includes(spec.info.version)
  );
  if (!pullRequest) {
    return false;
  }
  const { data: commits } = await octokit.repos.listCommits({
    owner: "EvanBacon",
    repo: "App-Store-Connect-OpenAPI-Specification",
    pull_number: pullRequest.number,
  });
  const commit = commits.find((c) =>
    c.commit.message.includes(spec.info.version)
  );
  if (!commit) {
    return false;
  }
  return true;
}

// open pull request with new file
async function openPullRequestAsync(spec: any): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN not set");
  }
  const octokit = new Octokit({
    auth: `token ${token}`,
  });
  const { data: pullRequests } = await octokit.pulls.list({
    owner: "EvanBacon",
    repo: "App-Store-Connect-OpenAPI-Specification",
    state: "open",
  });
  const pullRequest = pullRequests.find((pr) =>
    pr.title.includes(spec.info.version)
  );
  if (!pullRequest) {
    const { data: pullRequest } = await octokit.pulls.create({
      owner: "EvanBacon",
      repo: "App-Store-Connect-OpenAPI-Specification",
      title: `Update spec to ${spec.info.version}`,
      body: `This is an automatic update to the spec to ${spec.info.version}`,
    });
    const { data: commit } = await octokit.repos.createCommit({
      owner: "EvanBacon",
      repo: "App-Store-Connect-OpenAPI-Specification",
      message: `Update spec to ${spec.info.version}`,
      tree: {
        base_tree: "",
        tree: [
          {
            path: "specs/latest.json",
            mode: "100644",
            type: "blob",
            content: JSON.stringify(spec, null, 2),
          },
          {
            path: `specs/${spec.info.version ?? "unversioned"}.json`,
            mode: "100644",
            type: "blob",
            content: JSON.stringify(spec, null, 2),
          },
        ],
      },
      parents: [commit.sha],
      pull_number: pullRequest.number,
    });
    console.log("Commit:", commit.sha);
  }
}

async function getLatestSpecAsync() {
  const allTempDir = path.join(__dirname, "../temp");
  const tempFile = path.join(allTempDir, "temp.zip");
  const tempDir = path.join(allTempDir, "temp");
  try {
    await fs.remove(tempDir);
    await fs.remove(tempFile);
  } catch {}
  await fs.ensureDir(tempDir);
  await downloadZipFileAsync(
    "https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip",
    tempFile
  );
  await unzipToDirectoryAsync(tempFile, tempDir);
  const results = getJsonFileInDirectory(tempDir);
  console.log("spec at:", results);
  const jsonString = fs.readFileSync(results, "utf8");
  const json = JSON.parse(jsonString);

  return json;
}

async function downloadZipFileAsync(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  const stream = response.body;
  assert(stream);
  await pipeline(stream, fs.createWriteStream(dest));
}

async function unzipToDirectoryAsync(
  zipFile: string,
  directory: string
): Promise<void> {
  const zip = new StreamZip({
    file: zipFile,
    storeEntries: true,
  });
  await new Promise<void>((resolve, reject) => {
    zip.on("ready", () => {
      zip.extract(null, directory, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

function getJsonFileInDirectory(directory: string): string {
  const files = fs.readdirSync(directory);
  const file = files.find((f) => f.endsWith(".json"));
  if (!file)
    throw new Error(`Could not find JSON file in directory ${directory}`);
  return path.join(directory, file);
}

run();
