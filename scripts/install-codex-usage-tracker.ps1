[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$VSCodeUserTasksPath = (Join-Path $env:APPDATA 'Code\User\tasks.json'),
    [switch]$SkipVSCodeTask
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'tools\codex-usage'
$toolsRoot = Join-Path $CodexHome 'tools'
$runtimeFiles = @('CodexUsage.psm1', 'codex-usage-watch.ps1', 'codex-usage-pricing.json')

if ($PSCmdlet.ShouldProcess($toolsRoot, 'Install Codex usage tracker')) {
    [IO.Directory]::CreateDirectory($toolsRoot) | Out-Null
    foreach ($file in $runtimeFiles) {
        $source = Join-Path $sourceRoot $file
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing tracker file: $source" }
        Copy-Item -Force -LiteralPath $source -Destination (Join-Path $toolsRoot $file)
    }
}

if (-not $SkipVSCodeTask) {
    $templatePath = Join-Path $sourceRoot 'vscode-user-task.json'
    $template = Get-Content -Raw -LiteralPath $templatePath | ConvertFrom-Json -Depth 20
    $newTask = $template.tasks[0]
    $tasksParent = Split-Path -Parent $VSCodeUserTasksPath

    if ($PSCmdlet.ShouldProcess($VSCodeUserTasksPath, 'Install global VS Code user task')) {
        [IO.Directory]::CreateDirectory($tasksParent) | Out-Null
        if (Test-Path -LiteralPath $VSCodeUserTasksPath -PathType Leaf) {
            $raw = Get-Content -Raw -LiteralPath $VSCodeUserTasksPath
            try {
                $document = $raw | ConvertFrom-Json -Depth 30 -ErrorAction Stop
            } catch {
                throw "Existing VS Code tasks file is not strict JSON. Merge the task from $templatePath manually: $VSCodeUserTasksPath"
            }
            $backup = "$VSCodeUserTasksPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Copy-Item -LiteralPath $VSCodeUserTasksPath -Destination $backup
            $kept = @($document.tasks | Where-Object { $_.label -ne $newTask.label })
            $document.tasks = @($kept + $newTask)
        } else {
            $document = $template
        }

        $json = $document | ConvertTo-Json -Depth 30
        $temporary = "$VSCodeUserTasksPath.tmp-$PID"
        [IO.File]::WriteAllText($temporary, $json, [Text.UTF8Encoding]::new($false))
        Move-Item -Force -LiteralPath $temporary -Destination $VSCodeUserTasksPath
    }
}

Write-Host "Codex usage tracker installed in $toolsRoot"
if (-not $SkipVSCodeTask) { Write-Host "VS Code user task installed in $VSCodeUserTasksPath" }
Write-Host 'Run: Tasks: Run Task -> Codex: Watch Token Usage'
