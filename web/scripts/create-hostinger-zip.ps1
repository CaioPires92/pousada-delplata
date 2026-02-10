param(
    [string]$OutputZip = "deploy-hostinger.zip",
    [switch]$SkipChecks,
    [switch]$OptimizeImages,
    [switch]$KeepAllPhotos
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
    Write-Host "[deploy] $msg"
}

function Resolve-ProjectRoot {
    $root = (Get-Location).Path
    if (-not (Test-Path (Join-Path $root "package.json"))) {
        throw "Execute este script na raiz do projeto (onde existe package.json)."
    }
    return $root
}

function Get-ReferencedImages {
    $targets = New-Object System.Collections.Generic.List[string]

    if (Test-Path "src") {
        Get-ChildItem "src" -Recurse -File | ForEach-Object { $targets.Add($_.FullName) }
    }

    @(
        "scripts\seed-production.js",
        "src\lib\room-photos.ts"
    ) | Where-Object { Test-Path $_ } | ForEach-Object { $targets.Add((Resolve-Path $_).Path) }

    if ($targets.Count -eq 0) {
        return @()
    }

    $regex = [regex]'/fotos/[^''"")]+\.(jpg|jpeg|png|webp)'
    $found = New-Object System.Collections.Generic.List[string]
    foreach ($file in $targets) {
        $content = Get-Content -LiteralPath $file -Raw -ErrorAction SilentlyContinue
        if (-not $content) { continue }
        $matches = $regex.Matches($content)
        foreach ($m in $matches) {
            $found.Add($m.Value) | Out-Null
        }
    }

    return $found | Sort-Object -Unique
}

function Copy-ProjectBase([string]$projectRoot, [string]$stagingRoot) {
    if (Test-Path $stagingRoot) {
        Remove-Item $stagingRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingRoot | Out-Null

    $excludeDirs = @(
        "node_modules",
        ".next",
        ".git",
        "coverage",
        ".artifacts"
    )

    $excludeFiles = @(
        ".env",
        ".env.local",
        ".env.production.local",
        ".env.development.local",
        ".env.test.local",
        "deploy-hostinger.zip",
        "deploy-hostinger-lean.zip",
        "tsconfig.tsbuildinfo"
    )

    robocopy $projectRoot $stagingRoot /E /XD $excludeDirs /XF $excludeFiles /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
}

function Copy-ReferencedPhotos([string]$projectRoot, [string]$stagingRoot, [string[]]$references) {
    $publicFotos = Join-Path $projectRoot "public\fotos"
    if (-not (Test-Path $publicFotos)) {
        Write-Step "Pasta public/fotos nao encontrada; continuando sem filtro de fotos."
        return
    }

    $targetFotos = Join-Path $stagingRoot "public\fotos"
    if (Test-Path $targetFotos) {
        Remove-Item $targetFotos -Recurse -Force
    }
    New-Item -ItemType Directory -Path $targetFotos | Out-Null

    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($ref in $references) {
        $relative = $ref.TrimStart('/') -replace '/', '\'
        $src = Join-Path $projectRoot ("public\" + $relative)
        if (-not (Test-Path $src)) {
            $missing.Add($ref)
            continue
        }
        $dst = Join-Path $stagingRoot ("public\" + $relative)
        $dstDir = Split-Path $dst -Parent
        if (-not (Test-Path $dstDir)) {
            New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
        }
        Copy-Item $src $dst -Force
    }

    if ($missing.Count -gt 0) {
        Write-Step "Aviso: $($missing.Count) imagens referenciadas nao foram encontradas."
        $missing | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }
    }
}

function Remove-NonRuntimeFiles([string]$stagingRoot) {
    $removePatterns = @(
        "README.md",
        "ROADMAP.md",
        "QA-Plan.md",
        "PRODUCTION_CHECKLIST.md",
        "MERCADOPAGO_TRACKING_ERRORS.md",
        "TURSO_SETUP.md",
        "check-*.js",
        "create-test-user.js",
        "test-*.js",
        "test-*.ts",
        "test-*.html",
        "run-tests.js",
        "run-all-tests.js",
        "force-update.ts"
    )

    foreach ($pattern in $removePatterns) {
        Get-ChildItem -Path $stagingRoot -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }
}

function Optimize-StagedImages([string]$stagingRoot) {
    $target = Join-Path $stagingRoot "public\fotos"
    if (-not (Test-Path $target)) {
        Write-Step "Sem public/fotos no staging para otimizar."
        return
    }
    if (-not (Test-Path (Join-Path (Get-Location).Path "node_modules\sharp\package.json"))) {
        Write-Step "sharp nao encontrado; pulando otimizacao de imagens."
        return
    }
    Write-Step "Otimizando imagens do staging..."
    node ./scripts/optimize-staged-images.mjs $target | Out-Host
}

function Run-Guardrails([string]$projectRoot) {
    Write-Step "Rodando testes (guardrail)..."
    npm run test | Out-Host
    Write-Step "Rodando build (guardrail)..."
    npm run build | Out-Host
}

$projectRoot = Resolve-ProjectRoot
$outputPath = Join-Path $projectRoot $OutputZip
$stagingRoot = Join-Path $env:TEMP "hostinger-deploy-lean"

if (-not $SkipChecks) {
    Run-Guardrails -projectRoot $projectRoot
}

if (-not $KeepAllPhotos) {
    Write-Step "Coletando imagens referenciadas..."
    $referencedImages = Get-ReferencedImages
    Write-Step "Total de imagens referenciadas: $($referencedImages.Count)"
}

Write-Step "Copiando base do projeto..."
Copy-ProjectBase -projectRoot $projectRoot -stagingRoot $stagingRoot

if (-not $KeepAllPhotos) {
    Write-Step "Mantendo apenas fotos referenciadas em public/fotos..."
    Copy-ReferencedPhotos -projectRoot $projectRoot -stagingRoot $stagingRoot -references $referencedImages
} else {
    Write-Step "Mantendo todas as fotos (modo sem poda de referencias)."
}

Write-Step "Removendo arquivos nao essenciais para runtime..."
Remove-NonRuntimeFiles -stagingRoot $stagingRoot

if ($OptimizeImages) {
    Optimize-StagedImages -stagingRoot $stagingRoot
}

if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
}

Write-Step "Gerando ZIP..."
Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $outputPath -CompressionLevel Optimal

$zip = Get-Item $outputPath
$sizeMb = [math]::Round($zip.Length / 1MB, 2)
Write-Step "ZIP gerado: $($zip.FullName) ($sizeMb MB)"
