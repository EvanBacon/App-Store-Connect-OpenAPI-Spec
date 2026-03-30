import { mkdtemp, readdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const SPEC_URL =
  "https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export async function getLatestSpecAsync() {
  const temporaryDirectory = await mkdtemp(tmpdir() + path.sep);
  console.log("Temporary directory:", temporaryDirectory);

  const tempFile = path.join(temporaryDirectory, "temp.zip");
  const tempDir = path.join(temporaryDirectory, "temp");

  await downloadWithRetry(SPEC_URL, tempFile);
  await unzipToDirectoryAsync(tempFile, tempDir);

  const specFilePath = await getJsonFileInDirectory(tempDir);
  console.log("Spec downloaded at:", specFilePath);

  const file = Bun.file(specFilePath);
  return await file.json();
}

async function downloadWithRetry(url: string, dest: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      await Bun.write(dest, response);
      return;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      console.error(
        `Download attempt ${attempt}/${MAX_RETRIES} failed:`,
        error instanceof Error ? error.message : error
      );
      if (isLastAttempt) {
        throw new Error(
          `Failed to download spec after ${MAX_RETRIES} attempts: ${
            error instanceof Error ? error.message : error
          }`
        );
      }
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${backoff}ms...`);
      await Bun.sleep(backoff);
    }
  }
}

async function unzipToDirectoryAsync(
  zipFile: string,
  directory: string
): Promise<void> {
  // Bun has built-in support for shell commands
  const proc = Bun.spawn(["unzip", "-o", zipFile, "-d", directory], {
    stdout: "ignore",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to unzip: ${stderr}`);
  }
}

async function getJsonFileInDirectory(directory: string): Promise<string> {
  const files = await readdir(directory);
  const file = files.find((f) => f.endsWith(".json"));
  if (!file)
    throw new Error(`Could not find JSON file in directory ${directory}`);
  return path.join(directory, file);
}
