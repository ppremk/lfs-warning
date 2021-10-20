import * as core from '@actions/core';
import * as github from '@actions/github';
import {execFile} from 'child_process';
import * as micromatch from 'micromatch';
import {promisify} from 'util';

const execFileP = promisify(execFile);
const octokit = github.getOctokit(core.getInput('token'));
const context = github.context;
const {repo} = context;
const event_type = context.eventName;

async function run() {
  const fsl = getFileSizeLimitBytes();

  core.info(`Default configured filesizelimit is set to ${fsl} bytes...`);
  core.info(
    `Name of Repository is ${repo.repo} and the owner is ${repo.owner}`
  );
  core.info(`Triggered event is ${event_type}`);

  const labelName = 'lfs-detected!';

  await getOrCreateLfsWarningLabel(labelName);

  if (event_type === 'pull_request') {
    const pullRequestNumber = context.payload.pull_request?.number;

    if (pullRequestNumber === undefined) {
      throw new Error('Could not get PR number');
    }

    core.info(`The PR number is: ${pullRequestNumber}`);

    const prFilesWithBlobSize = await getPrFilesWithBlobSize(pullRequestNumber);

    core.debug(`prFilesWithBlobSize: ${JSON.stringify(prFilesWithBlobSize)}`);

    const largeFiles: string[] = [];
    const accidentallyCheckedInLsfFiles: string[] = [];
    for (const file of prFilesWithBlobSize) {
      const {fileblobsize, filename} = file;
      if (fileblobsize !== null && fileblobsize > Number(fsl)) {
        largeFiles.push(filename);
      } else {
        // look for files below threshold that should be stored in LFS but are not
        const shouldBeStoredInLFS = (
          await execFileP('git', ['check-attr', 'filter', filename])
        ).stdout.includes('filter: lfs');

        if (shouldBeStoredInLFS) {
          const isStoredInLFS = Boolean(
            file.patch?.includes('version https://git-lfs.github.com/spec/v1')
          );
          if (!isStoredInLFS) {
            accidentallyCheckedInLsfFiles.push(filename);
          }
        }
      }
    }

    const lsfFiles = largeFiles.concat(accidentallyCheckedInLsfFiles);

    const issueBaseProps = {
      ...repo,
      issue_number: pullRequestNumber,
    };

    if (lsfFiles.length > 0) {
      core.info('Detected file(s) that should be in LFS: ');
      core.info(lsfFiles.join('\n'));

      const body = getCommentBody(
        largeFiles,
        accidentallyCheckedInLsfFiles,
        fsl
      );

      await Promise.all([
        octokit.rest.issues.addLabels({
          ...issueBaseProps,
          labels: [labelName],
        }),
        octokit.rest.issues.createComment({
          ...issueBaseProps,
          body,
        }),
      ]);

      core.setOutput('lfsFiles', lsfFiles);
      core.setFailed(
        'Large File detected! Setting PR status to failed. Consider using git-lfs to track the LFS files'
      );
    } else {
      core.info('No large file(s) detected...');

      const {data: labels} = await octokit.rest.issues.listLabelsOnIssue({
        ...issueBaseProps,
      });
      if (labels.map(l => l.name).includes(labelName)) {
        await octokit.rest.issues.removeLabel({
          ...issueBaseProps,
          name: labelName,
        });
        core.info(`label ${labelName} removed`);
      }
    }
  } else {
    core.info('No Pull Request detected. Skipping LFS warning check');
  }
}

run().catch(error => {
  core.setFailed(error.message);
});

function getFileSizeLimitBytes() {
  const fsl = core.getInput('filesizelimit');

  const lastTwoChars = fsl.slice(-2).toLowerCase();

  if (lastTwoChars === 'mb') {
    return Number(fsl.slice(0, -2)) * 1024 * 1024;
  } else if (lastTwoChars === 'gb') {
    return Number(fsl.slice(0, -2)) * 1024 * 1024 * 1024;
  } else if (lastTwoChars[1] === 'b') {
    return fsl.slice(0, -1);
  } else {
    return fsl;
  }
}

async function getOrCreateLfsWarningLabel(labelName: string) {
  try {
    await octokit.rest.issues.getLabel({
      ...repo,
      name: labelName,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Not Found') {
        await octokit.rest.issues.createLabel({
          ...repo,
          name: 'lfs-detected!',
          color: 'ff1493',
          description:
            'Warning Label for use when LFS is detected in the commits of a Pull Request',
        });
        core.info('No lfs warning label detected. Creating new label ...');
        core.info('LFS warning label created');
      } else {
        core.error(`getLabel error: ${error.message}`);
      }
    }
  }
}

async function getPrFilesWithBlobSize(pullRequestNumber: number) {
  const {data} = await octokit.rest.pulls.listFiles({
    ...repo,
    pull_number: pullRequestNumber,
  });

  const exclusionPatterns = core.getMultilineInput('exclusionPatterns');

  const files =
    exclusionPatterns.length > 0
      ? data.filter(({filename}) => {
          const isExcluded = micromatch.isMatch(filename, exclusionPatterns);
          if (isExcluded) {
            core.info(`${filename} has been excluded from LFS warning`);
          }
          return !isExcluded;
        })
      : data;

  const prFilesWithBlobSize = await Promise.all(
    files.map(async file => {
      const {filename, sha, patch} = file;
      const {data: blob} = await octokit.rest.git.getBlob({
        ...repo,
        file_sha: sha,
      });

      return {
        filename,
        filesha: sha,
        fileblobsize: blob.size,
        patch,
      };
    })
  );
  return prFilesWithBlobSize;
}

function getCommentBody(
  largeFiles: string[],
  accidentallyCheckedInLsfFiles: string[],
  fsl: string | number
) {
  const largeFilesBody = `The following file(s) exceeds the file size limit: ${fsl} bytes, as set in the .yml configuration files:

        ${largeFiles.join(', ')}

        Consider using git-lfs to manage large files.
      `;

  const accidentallyCheckedInLsfFilesBody = `The following file(s) are tracked in LFS and were likely accidentally checked in:

        ${accidentallyCheckedInLsfFiles.join(', ')}
      `;

  const body = `## :warning: Possible file(s) that should be tracked in LFS detected :warning:
        ${largeFiles.length > 0 ? largeFilesBody : ''}
        ${
          accidentallyCheckedInLsfFiles.length > 0
            ? accidentallyCheckedInLsfFilesBody
            : ''
        }`;
  return body;
}
