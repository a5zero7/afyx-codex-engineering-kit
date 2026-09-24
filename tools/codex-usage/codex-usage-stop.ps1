[CmdletBinding()]
param(
    [string]$CodexHome = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }),
    [string]$PricingPath = (Join-Path $PSScriptRoot 'codex-usage-pricing.json'),
    [ValidateRange(0, 10)] [int]$RetryCount = 3,
    [ValidateRange(0, 1000)] [int]$RetryMilliseconds = 150
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Write-HookResult {
    param([string]$SystemMessage)

    $result = [ordered]@{ continue = $true }
    if ($SystemMessage) { $result.systemMessage = $SystemMessage }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress -Depth 5))
}

try {
    # Codex supplies one JSON object. last_assistant_message is intentionally never accessed,
    # copied, logged, hashed, or included in output.
    $rawEvent = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($rawEvent)) { Write-HookResult; exit 0 }
    $hookEvent = $rawEvent | ConvertFrom-Json -Depth 20 -ErrorAction Stop
    if ([string]$hookEvent.hook_event_name -ne 'Stop') { Write-HookResult; exit 0 }

    $turnId = [string]$hookEvent.turn_id
    $sessionId = [string]$hookEvent.session_id
    $transcriptPath = [string]$hookEvent.transcript_path
    if (-not $turnId -or -not $sessionId -or -not $transcriptPath) { Write-HookResult; exit 0 }

    $sessionRoot = [IO.Path]::GetFullPath((Join-Path $CodexHome 'sessions'))
    $resolvedTranscript = [IO.Path]::GetFullPath($transcriptPath)
    $rootPrefix = $sessionRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedTranscript.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { Write-HookResult; exit 0 }
    if ((Split-Path -Leaf $resolvedTranscript) -notmatch [regex]::Escape($sessionId)) { Write-HookResult; exit 0 }

    Import-Module (Join-Path $PSScriptRoot 'CodexUsage.psm1') -Force
    $pricing = Import-CodexPricing -Path $PricingPath
    $completion = $null
    for ($attempt = 0; $attempt -le $RetryCount; $attempt++) {
        $completion = Get-CodexTurnCompletion -TranscriptPath $resolvedTranscript -TurnId $turnId -Pricing $pricing
        if ($null -ne $completion) { break }
        if ($attempt -lt $RetryCount -and $RetryMilliseconds -gt 0) { Start-Sleep -Milliseconds $RetryMilliseconds }
    }

    if ($null -eq $completion) { Write-HookResult; exit 0 }
    Write-HookResult -SystemMessage (Format-CodexUsageUiMessage -Completion $completion)
} catch {
    # Usage reporting must never replace or interrupt the normal Codex result.
    Write-HookResult
}
