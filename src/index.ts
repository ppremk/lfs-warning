import * as core from "@actions/core";
import * as github from "@actions/github";
const octokit = github.getOctokit(core.getInput("token"));
const context = github.context;
const {owner, repo} = context.repo;
const event_type = context.eventName;

const labels = ['lfs-detected!'];

// most @actions toolkit packages have async methods
async function run() {
  try {
    const fsl = core.getInput('filesizelimit');

    core.info(`Default configured filesizelimit is set to ${fsl} bytes...`);
    core.info(`Name of Repository is ${repo} and the owner is ${owner}`);
    core.info(`Triggered event is ${event_type}`);

    // Get LFS Warning Label
    try {
      await octokit.rest.issues.getLabel({
        owner,
        repo,
        name: 'lfs-detected!',
      });
    } catch (error) {
      if (error.message === 'Not Found') {
        await octokit.rest.issues.createLabel({
          owner,
          repo,
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
        owner,
        repo,
        pull_number: pullRequestNumber,
      });

      const prFilesWithBlobSize = await Promise.all(
        files.map(async file => {
          const {filename, sha} = file;
          const {data: blob} = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: sha,
          });

          return {
            filename,
            filesha: sha,
            fileblobsize: blob.size,
          };
        })
      );

      core.info(String(prFilesWithBlobSize));

      const lsfFiles = [];
      for (const file of prFilesWithBlobSize) {
        const {fileblobsize, filename} = file;
        if (fileblobsize !== null && fileblobsize > Number(fsl)) {
          lsfFiles.push(filename);
        }
      }

      if (lsfFiles.length > 0) {
        core.info('Detected large file(s):');
        core.info(String(lsfFiles));

        const lfsFileNames = lsfFiles.join(', ');
        const bodyTemplate = `## :warning: Possible large file(s) detected :warning: \n
            The following file(s) exceeds the file size limit: ${fsl} bytes, as set in the .yml configuration files

            ${lfsFileNames.toString()}

            Consider using git-lfs as best practises to track and commit file(s)`;

        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: pullRequestNumber,
          labels,
        });

        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pullRequestNumber,
          body: bodyTemplate,
        });

        core.setOutput('lfsFiles', lsfFiles);
        core.setFailed(
          'Large File detected! Setting PR status to failed. Consider using git-lfs to track the LFS files'
        );
      } else {
        core.info('No large file(s) detected...');
      }

      // TODO:
      // git lfs attributes misconfiguration aka missing installation on client while git-lfs is configured on repo upstream
    } else {
      core.info('No Pull Request detected. Skipping LFS warning check');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
