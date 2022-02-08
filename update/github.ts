#!/usr/bin/env ts-node
import { Octokit } from "@octokit/rest";
import path from "path";

export function fileNameForSpec(spec: any) {
  return `specs/${spec.info.version ?? "unversioned"}.json`;
}

export async function openPullRequestIfSpecDoesNotExistAsync(
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
            path: fileNameForSpec(spec),
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
