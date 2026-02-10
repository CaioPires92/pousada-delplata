Write-Host "🧪 Testing Delplata-Motor API Endpoints..." -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3003/api"
$testResults = @()

# Test 1: Create Room
Write-Host "Test 1: Creating Room..." -ForegroundColor Yellow
$roomData = @{
    name = "Suite Deluxe"
    description = "Luxuosa suite com todas as comodidades"
    capacity = 4
    basePrice = 350
    totalUnits = 2
    amenities = "Ar-condicionado, WiFi, TV, Frigobar"
    photos = @("https://picsum.photos/seed/deluxe1/800/600")
} | ConvertTo-Json

try {
    $room = Invoke-RestMethod -Uri "$baseUrl/rooms" -Method Post -Body $roomData -ContentType "application/json"
    Write-Host "✅ Room created: $($room.id)" -ForegroundColor Green
    $roomId = $room.id
    $testResults += @{Test="Create Room"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Create Room"; Status="FAIL"}
    exit 1
}

# Test 2: Get All Rooms
Write-Host "`nTest 2: Getting All Rooms..." -ForegroundColor Yellow
try {
    $rooms = Invoke-RestMethod -Uri "$baseUrl/rooms" -Method Get
    Write-Host "✅ Found $($rooms.Count) room(s)" -ForegroundColor Green
    $testResults += @{Test="Get All Rooms"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Get All Rooms"; Status="FAIL"}
}

# Test 3: Get Single Room
Write-Host "`nTest 3: Getting Single Room..." -ForegroundColor Yellow
try {
    $singleRoom = Invoke-RestMethod -Uri "$baseUrl/rooms/$roomId" -Method Get
    Write-Host "✅ Room retrieved: $($singleRoom.name)" -ForegroundColor Green
    $testResults += @{Test="Get Single Room"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Get Single Room"; Status="FAIL"}
}

# Test 4: Create Rate
Write-Host "`nTest 4: Creating Rate..." -ForegroundColor Yellow
$rateData = @{
    roomTypeId = $roomId
    startDate = (Get-Date).ToString("yyyy-MM-dd")
    endDate = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
    price = 500
} | ConvertTo-Json

try {
    $rate = Invoke-RestMethod -Uri "$baseUrl/rates" -Method Post -Body $rateData -ContentType "application/json"
    Write-Host "✅ Rate created: R$ $($rate.price)" -ForegroundColor Green
    $testResults += @{Test="Create Rate"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Create Rate"; Status="FAIL"}
}

# Test 5: Set Inventory
Write-Host "`nTest 5: Setting Inventory..." -ForegroundColor Yellow
$inventoryData = @{
    roomTypeId = $roomId
    date = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
    totalUnits = 2
} | ConvertTo-Json

try {
    $inventory = Invoke-RestMethod -Uri "$baseUrl/inventory" -Method Post -Body $inventoryData -ContentType "application/json"
    Write-Host "✅ Inventory set: $($inventory.totalUnits) units" -ForegroundColor Green
    $testResults += @{Test="Set Inventory"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Set Inventory"; Status="FAIL"}
}

# Test 6: Check Availability
Write-Host "`nTest 6: Checking Availability..." -ForegroundColor Yellow
$checkIn = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$checkOut = (Get-Date).AddDays(3).ToString("yyyy-MM-dd")
try {
    $available = Invoke-RestMethod -Uri "$baseUrl/availability?checkIn=$checkIn&checkOut=$checkOut&adults=2&children=0" -Method Get
    Write-Host "✅ Found $($available.Count) available room(s)" -ForegroundColor Green
    $testResults += @{Test="Check Availability"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Check Availability"; Status="FAIL"}
}

# Test 7: Create Booking
Write-Host "`nTest 7: Creating Booking..." -ForegroundColor Yellow
$bookingData = @{
    roomTypeId = $roomId
    checkIn = $checkIn
    checkOut = $checkOut
    totalPrice = 1000
    guest = @{
        name = "João Silva"
        email = "joao@example.com"
        phone = "11999999999"
    }
} | ConvertTo-Json

try {
    $booking = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Post -Body $bookingData -ContentType "application/json"
    Write-Host "✅ Booking created: $($booking.id)" -ForegroundColor Green
    $testResults += @{Test="Create Booking"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Create Booking"; Status="FAIL"}
}

# Test 8: Get All Bookings
Write-Host "`nTest 8: Getting All Bookings..." -ForegroundColor Yellow
try {
    $bookings = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Get
    Write-Host "✅ Found $($bookings.Count) booking(s)" -ForegroundColor Green
    $testResults += @{Test="Get All Bookings"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Get All Bookings"; Status="FAIL"}
}

# Test 9: Admin Login
Write-Host "`nTest 9: Admin Login..." -ForegroundColor Yellow
$loginData = @{
    email = "admin@delplata.com.br"
    password = "admin"
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginData -ContentType "application/json" -SessionVariable session
    Write-Host "✅ Login successful" -ForegroundColor Green
    $testResults += @{Test="Admin Login"; Status="PASS"}
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    $testResults += @{Test="Admin Login"; Status="FAIL"}
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $testResults.Count

foreach ($result in $testResults) {
    $status = if ($result.Status -eq "PASS") { "✅" } else { "❌" }
    Write-Host "$status $($result.Test)" -ForegroundColor $(if ($result.Status -eq "PASS") { "Green" } else { "Red" })
}

Write-Host "`n" -NoNewline
Write-Host "Total: $total | Pass: $passCount | Fail: $failCount" -ForegroundColor Cyan
$percentage = [math]::Round(($passCount / $total) * 100, 2)
Write-Host "Success Rate: $percentage%" -ForegroundColor $(if ($percentage -eq 100) { "Green" } else { "Yellow" })
