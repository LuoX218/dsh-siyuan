<#
.SYNOPSIS
    dsh-siyuan-sync 卸载脚本（Windows）

.DESCRIPTION
    撤销 install.ps1 的三处改动：目录联接、dependencies、bundles。

.EXAMPLE
    .\uninstall.ps1
    .\uninstall.ps1 -Profile web
#>

param(
    [string]$Profile = "desktop"
)

$ErrorActionPreference = "Stop"

$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$ProfileDir = Join-Path $DshHome "profiles\$Profile"
$Manifest = Join-Path $ProfileDir "package.json"
$Link = Join-Path $ProfileDir "node_modules\dsh-siyuan-sync"
$PkgName = "dsh-siyuan-sync"

if (-not (Test-Path $Manifest)) {
    Write-Error "找不到 profile: $Manifest"
    exit 1
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $Manifest "$Manifest.bak-$Stamp"
Write-Host "==> 已备份: package.json.bak-$Stamp"

# 1) 移除目录联接
if (Test-Path $Link) {
    $item = Get-Item $Link -Force
    if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
        cmd /c rmdir "$Link" | Out-Null
        Write-Host "==> 已移除目录联接"
    } else {
        Write-Warning "$Link 是真实目录，未删除（避免误删你的代码）"
    }
}

# 2) 清理 package.json
$json = Get-Content $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json

if ($json.dependencies -and $json.dependencies.PSObject.Properties.Name -contains $PkgName) {
    $json.dependencies.PSObject.Properties.Remove($PkgName)
    Write-Host "==> 已从 dependencies 移除"
}

# 同样要检查属性存在性：空数组在 PowerShell 里是假值
if ($json.dsh -and $json.dsh.profile -and $null -ne $json.dsh.profile.PSObject.Properties["bundles"]) {
    $bundles = @($json.dsh.profile.bundles | Where-Object { $_ -ne $PkgName })
    $json.dsh.profile.bundles = $bundles
    Write-Host "==> 已从 bundles 移除"
}

$json | ConvertTo-Json -Depth 20 | Set-Content $Manifest -Encoding UTF8

Write-Host ""
Write-Host "完成。重启 DeepSeek Harness 后插件不再加载。"
