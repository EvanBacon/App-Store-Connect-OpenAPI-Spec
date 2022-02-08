#!/usr/bin/env ts-node
import assert from "assert";
import fs from "fs-extra";
import fetch from "node-fetch";
import StreamZip from "node-stream-zip";
import path from "path";
import { Stream } from "stream";
import { promisify } from "util";

const pipeline = promisify(Stream.pipeline);

export async function getLatestSpecAsync() {
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
