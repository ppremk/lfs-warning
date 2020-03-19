const core = require('@actions/core');


// most @actions toolkit packages have async methods
async function run() {
  try { 
    const fsl = core.getInput('filesizelimit');
    console.log(`Default configured filesizelimit is set to ${fsl} bytes...`)

    core.setOutput('action start time', new Date().toTimeString());

    // do logic in here

    core.setOutput('action end time', new Date().toTimeString());
  } 
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
