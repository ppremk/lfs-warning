import * as core from '@actions/core';
import * as github from '@actions/github';
import {exec} from 'child_process';
import {promisify} from 'util';
const execP = promisify(exec);
const octokit = github.getOctokit(core.getInput('token'));
const context = github.context;
const {repo} = context;
const event_type = context.eventName;

// most @actions toolkit packages have async methods
async function run() {
  try {
    const fsl = core.getInput('filesizelimit');

    core.info(`Default configured filesizelimit is set to ${fsl} bytes...`);
    core.info(`Name of Repository is ${repo.repo} and the owner is ${repo.owner}`);
    core.info(`Triggered event is ${event_type}`);

    const labelName = 'lfs-detected!'

    // Get LFS Warning Label
    try {
      await octokit.rest.issues.getLabel({
        ...repo,
        name: labelName,
      });
    } catch (error) {
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

    // Get List of files for Pull Request
    if (event_type === 'pull_request') {
      const pullRequestNumber = context.payload.pull_request?.number;

      if (pullRequestNumber === undefined) {
        throw new Error('Could not get PR number');
      }

      core.info(`The PR number is: ${pullRequestNumber}`);

      const {data: files} = await octokit.rest.pulls.listFiles({
        ...repo,
        pull_number: pullRequestNumber,
      });

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

      core.info(String(prFilesWithBlobSize));

      const largeFiles: string[] = [];
      const accidentallyCheckedInLsfFiles: string[] = [];
      for (const file of prFilesWithBlobSize) {
        const {fileblobsize, filename} = file;
        if (fileblobsize !== null && fileblobsize > Number(fsl)) {
          largeFiles.push(filename);
        } else {
          // look for files below threshold that should be stored in LFS but are not
          const shouldBeStoredInLFS = (
            await execP(`git check-attr filter ${filename}`)
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

      if (lsfFiles.length > 0) {
        core.info('Detected file(s) that should be in LFS:');
        core.info(String(lsfFiles));

        const largeFilesBody = `The following file(s) exceeds the file size limit: ${100} bytes, as set in the .yml configuration files:

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

        await octokit.rest.issues.addLabels({
          ...repo,
          issue_number: pullRequestNumber,
          labels: [labelName],
        });

        await octokit.rest.issues.createComment({
          ...repo,
          issue_number: pullRequestNumber,
          body,
        });

        core.setOutput('lfsFiles', lsfFiles);
        core.setFailed(
          'Large File detected! Setting PR status to failed. Consider using git-lfs to track the LFS files'
        );
      } else {
        core.info('No large file(s) detected...');

        const {data: labels} = await octokit.rest.issues.listLabelsOnIssue({
          ...repo,
          issue_number: 1,
        })
        if (labels.map(l => l.name).includes(labelName)) {
          await octokit.rest.issues.removeLabel({
            ...repo,
            issue_number: 1,
            name: labelName
          });
          core.info(`label ${labelName} removed`)
        }
      }
    } else {
      core.info('No Pull Request detected. Skipping LFS warning check');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
