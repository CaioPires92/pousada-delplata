param(
    [ValidateSet("install", "build", "start", "zip-lean", "zip-lean-fast", "zip-allphotos-fast", "full-lean", "full-allphotos")]
    [string]$Action = "full-allphotos"
)

$ErrorActionPreference = "Stop"

function Step([string]$msg) {
    Write-Host "[hostinger] $msg"
}

switch ($Action) {
    "install" {
        Step "npm ci"
        npm ci
    }
    "build" {
        Step "npm run build"
        npm run build
    }
    "start" {
        Step "npm run start"
        npm run start
    }
    "zip-lean" {
        Step "npm run deploy:zip:lean"
        npm run deploy:zip:lean
    }
    "zip-lean-fast" {
        Step "npm run deploy:zip:lean:fast"
        npm run deploy:zip:lean:fast
    }
    "zip-allphotos-fast" {
        Step "npm run deploy:zip:allphotos:fast"
        npm run deploy:zip:allphotos:fast
    }
    "full-lean" {
        Step "npm ci"
        npm ci
        Step "npm run build"
        npm run build
        Step "npm run deploy:zip:lean"
        npm run deploy:zip:lean
    }
    "full-allphotos" {
        Step "npm ci"
        npm ci
        Step "npm run build"
        npm run build
        Step "npm run deploy:zip:allphotos:fast"
        npm run deploy:zip:allphotos:fast
    }
}
