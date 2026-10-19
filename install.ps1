<#
.SYNOPSIS
    dsh-siyuan-sync 安装脚本（Windows）

.DESCRIPTION
    按「第三方插件」的标准方式安装：写进 profile 的 dependencies 与
    dsh.profile.bundles，这样它才会出现在「设置 → 插件」的第三方插件列表里。

    用目录联接（Junction）代替符号链接，不需要管理员权限。

.EXAMPLE
    .\install.ps1
    .\install.ps1 -Profile web
    .\install.ps1 -DryRun
#>

param(
    [string]$Profile = "desktop",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$PluginDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$Manifest = Join-Path $ProfileDir "package.json"
$Link = Join-Path $ProfileDir "node_modules\dsh-siyuan-sync"
$PkgName = "dsh-siyuan-sync"

if (-not (Test-Path $Manifest)) {
    Write-Error "找不到 profile: $Manifest"
    exit 1
}

Write-Host "==> 插件目录: $PluginDir"
Write-Host "==> 目标 profile: $ProfileDir"

# 备份
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = "$Manifest.bak-$Stamp"
Copy-Item $Manifest $Backup
Write-Host "==> 已备份: package.json.bak-$Stamp"

if ($DryRun) {
    Write-Host "[dry-run] 创建目录联接: $Link -> $PluginDir"
    Write-Host "[dry-run] 写入 dependencies 与 bundles"
    exit 0
}

# 1) 目录联接（不需要管理员权限，这是和符号链接的关键区别）
$NodeModules = Join-Path $ProfileDir "node_modules"
if (-not (Test-Path $NodeModules)) {
    New-Item -ItemType Directory -Path $NodeModules -Force | Out-Null
}

if (Test-Path $Link) {
    $item = Get-Item $Link -Force
    if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
        Write-Host "==> 移除已存在的链接"
        cmd /c rmdir "$Link" | Out-Null
    } else {
        Write-Warning "$Link 已存在且不是链接，跳过"
        exit 0
    }
}

New-Item -ItemType Junction -Path $Link -Target $PluginDir | Out-Null
Write-Host "==> 已创建目录联接"

# 2) 写入 package.json
$json = Get-Content $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $json.dependencies) {
    $json | Add-Member -NotePropertyName "dependencies" -NotePropertyValue ([PSCustomObject]@{})
}
$json.dependencies | Add-Member -NotePropertyName $PkgName -NotePropertyValue ("file:" + $PluginDir) -Force

if (-not $json.dsh) {
    $json | Add-Member -NotePropertyName "dsh" -NotePropertyValue ([PSCustomObject]@{})
}
if (-not $json.dsh.profile) {
    $json.dsh | Add-Member -NotePropertyName "profile" -NotePropertyValue ([PSCustomObject]@{})
}
if (-not $json.dsh.profile.bundles) {
    $json.dsh.profile | Add-Member -NotePropertyName "bundles" -NotePropertyValue @()
}
if ($json.dsh.profile.bundles -notcontains $PkgName) {
    $json.dsh.profile.bundles += $PkgName
}

$json | ConvertTo-Json -Depth 20 | Set-Content $Manifest -Encoding UTF8
Write-Host "==> 已写入 dependencies 与 bundles"

Write-Host ""
Write-Host "完成。重启 DeepSeek Harness 后："
Write-Host "  · 设置 → 插件 → 第三方插件，可以看到 $PkgName"
Write-Host "  · 右键任意消息 → 「同步到思源」"
Write-Host ""
Write-Host "回滚：.\uninstall.ps1 -Profile $Profile"
