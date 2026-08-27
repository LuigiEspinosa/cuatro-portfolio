# Story 1-8 operator action 7: prove the password manager's copy of
# BACKUP_PASSPHRASE actually opens an object from the bucket.
#
# Run this from the workstation, never from 177.7.52.248, and paste the
# passphrase from the password manager rather than from the box. That is the
# whole point: encryption and nightly verification both read the same value from
# the same file on the same box, so nothing on the box can detect a manager entry
# that is wrong, truncated or absent. Only this check can.
#
# The passphrase is read as a SecureString, never echoed, never written to disk,
# and never passed as a command-line argument. Both temporary files are deleted
# before the script returns.
#
# Reads R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY from .env, which is gitignored.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$cfg = @{}
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') {
    $cfg[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

$env:AWS_ACCESS_KEY_ID = $cfg['R2_ACCESS_KEY_ID']
$env:AWS_SECRET_ACCESS_KEY = $cfg['R2_SECRET_ACCESS_KEY']
$env:AWS_DEFAULT_REGION = 'auto'
$env:AWS_S3_ADDRESSING_STYLE = 'path'

# Scheme and host only. The bucket travels separately, in --bucket. An endpoint
# with the bucket appended as a path is what made the first offsite run fail.
$endpoint = 'https://cd0752bce97437c466e4786a20ea6618.r2.cloudflarestorage.com'
$bucket = 'cuatro-backups'

Write-Host 'Finding the newest object under digital-library/ ...'
$keys = aws s3api list-objects-v2 --bucket $bucket --prefix 'digital-library/' `
  --query 'sort_by(Contents,&LastModified)[-1].Key' --output text --endpoint-url $endpoint 2>&1

if ($LASTEXITCODE -ne 0 -or -not $keys -or $keys -eq 'None') {
  # An object-scoped token may be refused ListObjectsV2 while still allowed
  # GetObject, so a listing failure is not a reason to stop.
  Write-Host 'Could not list the bucket. Enter the object key by hand.'
  Write-Host 'Find it in the nightly log: /home/deploy/backups/digital-library/backup.log'
  $keys = Read-Host 'Object key (digital-library/library-....tar.gz.gpg)'
}
Write-Host "Object: $keys"

$enc = Join-Path $env:TEMP 'pm-verify.tar.gz.gpg'
aws s3api get-object --bucket $bucket --key $keys $enc --endpoint-url $endpoint | Out-Null
Write-Host "Downloaded $((Get-Item $enc).Length) bytes."

$secure = Read-Host 'Paste BACKUP_PASSPHRASE from the password manager' -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
Write-Host "Read $($plain.Length) characters. Expected 48."

# The passphrase reaches gpg on stdin, so it appears in no argument list and no
# history file. wsl runs gpg because the Windows side has none.
$wslEnc = '/mnt/' + $enc.Substring(0,1).ToLower() + $enc.Substring(2).Replace('\','/')
$plain | wsl -d Ubuntu-22.04 bash -c "gpg --batch --yes --passphrase-fd 0 --decrypt --output /tmp/pm-verify.tar.gz '$wslEnc' 2>/dev/null && echo 'DECRYPT: ok' && tar -tzf /tmp/pm-verify.tar.gz && rm -f /tmp/pm-verify.tar.gz || echo 'DECRYPT: FAILED'"

Remove-Item $enc -Force -ErrorAction SilentlyContinue
$plain = $null
Write-Host 'Temporary files removed.'
Write-Host ''
Write-Host 'DECRYPT: ok plus a listing of library.db, books/, covers/ and inbox/'
Write-Host 'means the password manager holds a working passphrase and named limit 5 is closed.'
Write-Host 'DECRYPT: FAILED means the manager copy is wrong. Re-copy it from the box and rerun.'
