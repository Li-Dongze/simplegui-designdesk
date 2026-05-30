param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$InputPath,

  [Parameter(Position = 1)]
  [string]$OutputPath,

  [switch]$Recurse,
  [switch]$Overwrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$workspace = Split-Path -Parent $PSScriptRoot

function Resolve-AbsolutePath([string]$pathValue) {
  if ([System.IO.Path]::IsPathRooted($pathValue)) {
    return [System.IO.Path]::GetFullPath($pathValue)
  }
  return [System.IO.Path]::GetFullPath((Join-Path -Path (Get-Location).Path -ChildPath $pathValue))
}

function Get-DefaultBmpPath([string]$sourcePath) {
  $dir = [System.IO.Path]::GetDirectoryName($sourcePath)
  $name = [System.IO.Path]::GetFileNameWithoutExtension($sourcePath)
  return [System.IO.Path]::Combine($dir, "$name.bmp")
}

function Convert-OneImage([string]$sourcePath, [string]$targetPath) {
  if ([System.IO.Path]::GetExtension($targetPath).ToLowerInvariant() -ne ".bmp") {
    throw "Output file must use .bmp extension: $targetPath"
  }

  $targetDir = [System.IO.Path]::GetDirectoryName($targetPath)
  if (-not [string]::IsNullOrWhiteSpace($targetDir) -and -not (Test-Path -LiteralPath $targetDir -PathType Container)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }

  if ((Test-Path -LiteralPath $targetPath -PathType Leaf) -and -not $Overwrite) {
    throw "Output file already exists (use -Overwrite): $targetPath"
  }

  $image = $null
  $bitmap = $null
  $graphics = $null
  try {
    $image = [System.Drawing.Image]::FromFile($sourcePath)
    $bitmap = New-Object System.Drawing.Bitmap($image.Width, $image.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.DrawImage($image, 0, 0, $image.Width, $image.Height)
    $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
  }
  finally {
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
    if ($image) { $image.Dispose() }
  }
}

$source = Resolve-AbsolutePath $InputPath
if (-not (Test-Path -LiteralPath $source)) {
  throw "Input path not found: $source"
}

$isSourceDirectory = Test-Path -LiteralPath $source -PathType Container
$supportedExtensions = @(".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff", ".bmp")

if (-not $isSourceDirectory) {
  $target = $null
  if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $target = Get-DefaultBmpPath $source
  }
  else {
    $resolvedOut = Resolve-AbsolutePath $OutputPath
    if ((Test-Path -LiteralPath $resolvedOut -PathType Container) -or [System.IO.Path]::GetExtension($resolvedOut) -eq "") {
      if (-not (Test-Path -LiteralPath $resolvedOut -PathType Container)) {
        New-Item -ItemType Directory -Path $resolvedOut -Force | Out-Null
      }
      $name = [System.IO.Path]::GetFileNameWithoutExtension($source)
      $target = [System.IO.Path]::Combine($resolvedOut, "$name.bmp")
    }
    else {
      $target = $resolvedOut
    }
  }

  Convert-OneImage -sourcePath $source -targetPath $target
  Write-Host "Converted:"
  Write-Host "  Source: $source"
  Write-Host "  Target: $target"
  exit 0
}

$outputRoot = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  Join-Path -Path $source -ChildPath "_bmp"
} else {
  Resolve-AbsolutePath $OutputPath
}

if (-not (Test-Path -LiteralPath $outputRoot -PathType Container)) {
  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
}

$searchOption = if ($Recurse) { "-Recurse" } else { "" }
$files = if ($Recurse) {
  Get-ChildItem -LiteralPath $source -File -Recurse
} else {
  Get-ChildItem -LiteralPath $source -File
}

$imageFiles = $files | Where-Object {
  $ext = [System.IO.Path]::GetExtension($_.Name).ToLowerInvariant()
  $supportedExtensions -contains $ext
}

if (-not $imageFiles -or $imageFiles.Count -eq 0) {
  Write-Host "No supported image files found under: $source"
  exit 0
}

$converted = 0
foreach ($file in $imageFiles) {
  $relative = [System.IO.Path]::GetRelativePath($source, $file.FullName)
  $relativeDir = [System.IO.Path]::GetDirectoryName($relative)
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($relative)
  $targetDir = if ([string]::IsNullOrWhiteSpace($relativeDir)) { $outputRoot } else { Join-Path -Path $outputRoot -ChildPath $relativeDir }
  $target = Join-Path -Path $targetDir -ChildPath "$baseName.bmp"

  Convert-OneImage -sourcePath $file.FullName -targetPath $target
  $converted += 1
}

Write-Host "Batch convert completed."
Write-Host "  Source directory: $source"
Write-Host "  Output directory: $outputRoot"
Write-Host "  Converted files:  $converted"
