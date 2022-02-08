#!/usr/bin/env ts-node
import { Octokit } from "@octokit/rest";
import assert from "assert";

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

function getOctokit() {
  const { GITHUB_TOKEN } = process.env;

  assert(GITHUB_TOKEN, "GITHUB_TOKEN is required");

  return new Octokit({
    auth: `token ${GITHUB_TOKEN}`,
  });
}

async function checkIfSpecExistsAlready(spec: any): Promise<boolean> {
  const { GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY } = process.env;

  assert(GITHUB_REPOSITORY_OWNER);
  assert(GITHUB_REPOSITORY);

  const GITHUB_REPOSITORY_NAME = GITHUB_REPOSITORY.replace(
    `${GITHUB_REPOSITORY_OWNER}/`,
    ""
  );

  const octokit = getOctokit();
  const { data: pullRequests } = await octokit.pulls.list({
    owner: GITHUB_REPOSITORY_OWNER,
    repo: GITHUB_REPOSITORY_NAME,
    state: "open",
  });
  const pullRequest = pullRequests.find((pr) =>
    pr.title.includes(spec.info.version)
  );
  if (!pullRequest) {
    return false;
  }
  const { data: commits } = await octokit.repos.listCommits({
    owner: GITHUB_REPOSITORY_OWNER,
    repo: GITHUB_REPOSITORY_NAME,
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
  const { GITHUB_REPOSITORY_OWNER, GITHUB_ACTOR, GITHUB_REPOSITORY } =
    process.env;

  assert(GITHUB_REPOSITORY_OWNER);
  assert(GITHUB_REPOSITORY);
  const GITHUB_REPOSITORY_NAME = GITHUB_REPOSITORY.replace(
    `${GITHUB_REPOSITORY_OWNER}/`,
    ""
  );

  const octokit = getOctokit();
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
      owner: GITHUB_REPOSITORY_OWNER,
      repo: GITHUB_REPOSITORY_NAME,
      title: `Update spec to ${spec.info.version}`,
      body: `This is an automatic update to the spec to ${spec.info.version}`,
      base: "main",
      head: `${GITHUB_ACTOR}:${spec.info.version}`,
    });

    const { data: commit } = await octokit.repos.createCommit({
      owner: GITHUB_REPOSITORY_OWNER,
      repo: GITHUB_REPOSITORY_NAME,
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
