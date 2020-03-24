## LFS-Warning action

This action scans files in commits of a Pull Request and compares it against the configured file size limit threshold. If the threshold is exceeded for any of the file, the action will mark the pull request as failed. 

Note: Remember to configure the branch protection rule and select the `LFS-warning` status when you enable the `Required status check to pass` option.

## Inputs

#### `filesizelimit `

Required, set's the file size limit threshold in bytes. Default "10MB".

## Outputs

#### `lfsFiles `

Returns an array of possible detected large file(s)

## Usage

Consume the action by referencing the stable branch

```yaml
uses: ppremk/lfs-warning@stable
with:
  filesizelimit: '10485760' # 10 MB is 10485760 Bytes
```
