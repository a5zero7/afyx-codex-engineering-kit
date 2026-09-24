[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$modulePath = Join-Path $root 'CodexUsage.psm1'
$watcherPath = Join-Path $root 'codex-usage-watch.ps1'
$pricingPath = Join-Path $root 'codex-usage-pricing.json'
Import-Module $modulePath -Force
$pricing = Import-CodexPricing $pricingPath

function Assert-Equal {
    param([object]$Actual, [object]$Expected, [string]$Message)
    if ($Actual -ne $Expected) { throw "$Message. Expected '$Expected', got '$Actual'." }
}

function New-Event {
    param([string]$Type, [hashtable]$Payload)
    return [pscustomobject]@{ timestamp = [DateTime]::UtcNow.ToString('o'); type = $Type; payload = [pscustomobject]$Payload }
}

function New-UsageObject {
    param(
        [long]$InputTokens,
        [long]$CachedTokens,
        [long]$CacheWriteTokens,
        [long]$OutputTokens,
        [long]$ReasoningTokens
    )
    return [pscustomobject]@{
        input_tokens = $InputTokens
        cached_input_tokens = $CachedTokens
        cache_write_input_tokens = $CacheWriteTokens
        output_tokens = $OutputTokens
        reasoning_output_tokens = $ReasoningTokens
        total_tokens = $InputTokens + $OutputTokens
    }
}

function New-TurnEvents {
    param(
        [string]$TurnId,
        [string]$Model,
        [object]$Usage,
        [object]$TurnUsage,
        [object]$ThreadUsage
    )
    return @(
        New-Event 'event_msg' @{ type = 'task_started'; turn_id = $TurnId }
        New-Event 'turn_context' @{ turn_id = $TurnId; model = $Model }
        New-Event 'token_usage_record' @{
            turn_id = $TurnId
            usage = $Usage
            turn_token_usage = $TurnUsage
            thread_token_usage = $ThreadUsage
        }
        New-Event 'event_msg' @{ type = 'token_count'; info = @{ total_token_usage = $ThreadUsage } }
        New-Event 'event_msg' @{ type = 'task_complete'; turn_id = $TurnId; completed_at = [DateTime]::UtcNow.ToString('o') }
    )
}

function Invoke-Events {
    param([object]$State, [object[]]$Events)
    $result = [System.Collections.Generic.List[object]]::new()
    foreach ($event in $Events) {
        $completion = Update-CodexUsageState -State $State -Event $event -Pricing $pricing -SessionFile 'rollout-test.jsonl'
        if ($null -ne $completion) { $result.Add($completion) }
    }
    return $result.ToArray()
}

function Add-EventsToFile {
    param([string]$Path, [object[]]$Events)
    $lines = $Events | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 20 }
    [IO.File]::AppendAllText($Path, (($lines -join "`n") + "`n"), [Text.UTF8Encoding]::new($false))
}

function Start-TestWatcher {
    param([string]$SessionRoot, [string]$LatestPath, [int]$CompletionCount)
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = (Get-Command pwsh).Source
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    foreach ($argument in @(
        '-NoLogo', '-NoProfile', '-File', $watcherPath,
        '-SessionRoot', $SessionRoot,
        '-PricingPath', $pricingPath,
        '-LatestUsagePath', $LatestPath,
        '-PollMilliseconds', '200',
        '-ExitAfterCompletions', [string]$CompletionCount
    )) { [void]$psi.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $psi
    [void]$process.Start()
    return [pscustomobject]@{
        Process = $process
        Output = $process.StandardOutput.ReadToEndAsync()
        Error = $process.StandardError.ReadToEndAsync()
    }
}

$usage1 = New-UsageObject 100 60 10 20 5
$thread1 = New-UsageObject 100 60 10 20 5
$usage2 = New-UsageObject 80 20 0 10 2
$thread2 = New-UsageObject 180 80 10 30 7
$turn1 = New-TurnEvents 'turn-1' 'gpt-5.6-sol' $usage1 $usage1 $thread1
$turn2 = New-TurnEvents 'turn-2' 'gpt-5.6-sol' $usage2 $usage2 $thread2

$state = New-CodexUsageParserState
$first = @(Invoke-Events $state $turn1)
$second = @(Invoke-Events $state $turn2)
Assert-Equal $first.Count 1 'First turn completion count'
Assert-Equal $second.Count 1 'Second turn completion count'
Assert-Equal $first[0].InputTokens 100 'First turn input'
Assert-Equal $first[0].CachedInputTokens 60 'First turn cached input'
Assert-Equal $first[0].CacheWriteInputTokens 10 'First turn cache write input'
Assert-Equal $first[0].UncachedInputTokens 30 'First turn uncached input'
Assert-Equal $first[0].OutputTokens 20 'First turn output'
Assert-Equal $first[0].ReasoningTokens 5 'First turn reasoning breakdown'
Assert-Equal $first[0].TotalTokens 120 'Reasoning must not be added to total'
Assert-Equal $first[0].ApiEquivalentCost ([decimal]0.000594) 'First turn API-equivalent cost'
Assert-Equal $second[0].InputTokens 80 'Second turn must be a delta, not cumulative'
Assert-Equal $second[0].TotalTokens 90 'Second turn total'

$restartState = New-CodexUsageParserState
[void](Invoke-Events $restartState $turn1)
$restartSecond = @(Invoke-Events $restartState $turn2)
Assert-Equal $restartSecond.Count 1 'Restart baseline completion count'
Assert-Equal $restartSecond[0].InputTokens 80 'Restart baseline must preserve per-turn delta'

$unknownState = New-CodexUsageParserState
$unknown = @(Invoke-Events $unknownState (New-TurnEvents 'unknown-1' 'unpriced-model' $usage1 $usage1 $thread1))
Assert-Equal $unknown[0].ApiEquivalentAvailable $false 'Unknown model pricing fallback'

$gapState = New-CodexUsageParserState
[void](Invoke-Events $gapState $turn1)
$abortedUsage = New-UsageObject 50 20 0 4 1
$abortedThread = New-UsageObject 150 80 10 24 6
[void](Invoke-Events $gapState @(
    New-Event 'event_msg' @{ type = 'task_started'; turn_id = 'aborted' }
    New-Event 'turn_context' @{ turn_id = 'aborted'; model = 'gpt-5.6-sol' }
    New-Event 'token_usage_record' @{ usage = $abortedUsage; turn_token_usage = $abortedUsage; thread_token_usage = $abortedThread }
))
$successUsage = New-UsageObject 70 30 0 8 2
$successThread = New-UsageObject 220 110 10 32 8
$afterGap = @(Invoke-Events $gapState (New-TurnEvents 'after-gap' 'gpt-5.6-sol' $successUsage $successUsage $successThread))
Assert-Equal $afterGap[0].UsageSource 'turn_token_usage' 'Aborted-turn gap source'
Assert-Equal $afterGap[0].InputTokens 70 'Aborted turn must not leak into next completed turn'

$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ('codex-usage-tests-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temporaryRoot) | Out-Null
try {
    $sessions = Join-Path $temporaryRoot 'sessions'
    $day1 = Join-Path $sessions '2026\09\24'
    [IO.Directory]::CreateDirectory($day1) | Out-Null
    $rollout1 = Join-Path $day1 'rollout-test-1.jsonl'
    [IO.File]::WriteAllText($rollout1, '', [Text.UTF8Encoding]::new($false))
    $latestPath = Join-Path $temporaryRoot 'latest.json'
    $watcher = Start-TestWatcher $sessions $latestPath 3
    try {
        Start-Sleep -Seconds 1
        if ($watcher.Process.HasExited) { throw "Live watcher exited before input: $($watcher.Error.GetAwaiter().GetResult())" }
        Add-EventsToFile $rollout1 $turn1
        Start-Sleep -Milliseconds 500
        Add-EventsToFile $rollout1 $turn2

        $rollout2 = Join-Path $day1 'rollout-test-2.jsonl'
        [IO.File]::WriteAllText($rollout2, '', [Text.UTF8Encoding]::new($false))
        Start-Sleep -Milliseconds 500
        $session2Usage = New-UsageObject 40 10 0 6 1
        Add-EventsToFile $rollout2 (New-TurnEvents 'session-2-turn-1' 'gpt-5.6-sol' $session2Usage $session2Usage $session2Usage)

        if (-not $watcher.Process.WaitForExit(15000)) {
            $watcher.Process.Kill($true)
            $watcher.Process.WaitForExit()
            throw "Live watcher did not exit after three completions. Output: $($watcher.Output.GetAwaiter().GetResult()) Error: $($watcher.Error.GetAwaiter().GetResult())"
        }
        $output = $watcher.Output.GetAwaiter().GetResult()
        $errors = $watcher.Error.GetAwaiter().GetResult()
        Assert-Equal $watcher.Process.ExitCode 0 "Live watcher exit code; stderr: $errors"
        Assert-Equal ([regex]::Matches($output, 'Codex Turn Usage').Count) 3 'Live watcher summary count'
    } finally {
        if (-not $watcher.Process.HasExited) { $watcher.Process.Kill($true) }
    }

    $restartWatcher = Start-TestWatcher $sessions $latestPath 1
    try {
        Start-Sleep -Seconds 1
        if ($restartWatcher.Process.HasExited) { throw "Restarted watcher exited before input: $($restartWatcher.Error.GetAwaiter().GetResult())" }
        $session2Turn2 = New-UsageObject 55 20 0 7 2
        $session2Total = New-UsageObject 95 30 0 13 3
        Add-EventsToFile $rollout2 (New-TurnEvents 'session-2-turn-2' 'gpt-5.6-sol' $session2Turn2 $session2Turn2 $session2Total)
        if (-not $restartWatcher.Process.WaitForExit(15000)) {
            $restartWatcher.Process.Kill($true)
            $restartWatcher.Process.WaitForExit()
            throw "Restarted watcher did not exit after one new completion. Output: $($restartWatcher.Output.GetAwaiter().GetResult()) Error: $($restartWatcher.Error.GetAwaiter().GetResult())"
        }
        $restartOutput = $restartWatcher.Output.GetAwaiter().GetResult()
        $restartErrors = $restartWatcher.Error.GetAwaiter().GetResult()
        Assert-Equal $restartWatcher.Process.ExitCode 0 "Restarted watcher exit code; stderr: $restartErrors"
        Assert-Equal ([regex]::Matches($restartOutput, 'Codex Turn Usage').Count) 1 'Restarted watcher must not replay history'
        if (-not $restartOutput.Contains('55 tokens')) { throw 'Restarted watcher did not report only the new turn.' }
    } finally {
        if (-not $restartWatcher.Process.HasExited) { $restartWatcher.Process.Kill($true) }
    }
} finally {
    if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -Recurse -Force -LiteralPath $temporaryRoot }
}

Write-Host 'Codex usage tracker tests: PASS'
