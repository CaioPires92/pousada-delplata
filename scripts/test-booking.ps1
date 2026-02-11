Write-Host "🧪 Testing Booking Page Flow..." -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001"

# Test 1: Create a test room first
Write-Host "Test 1: Creating test room..." -ForegroundColor Yellow
$roomData = @{
    name = "Quarto Teste"
    description = "Quarto para testar o fluxo de reserva"
    capacity = 2
    basePrice = 200
    totalUnits = 3
    amenities = "WiFi, TV, Ar-condicionado"
    photos = @("https://picsum.photos/seed/teste1/800/600")
} | ConvertTo-Json

try {
    $room = Invoke-RestMethod -Uri "$baseUrl/api/rooms" -Method Post -Body $roomData -ContentType "application/json"
    Write-Host "✅ Room created: $($room.id)" -ForegroundColor Green
    $roomId = $room.id
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Set a rate
Write-Host "`nTest 2: Setting rate..." -ForegroundColor Yellow
$rateData = @{
    roomTypeId = $roomId
    startDate = (Get-Date).ToString("yyyy-MM-dd")
    endDate = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
    price = 250
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/api/rates" -Method Post -Body $rateData -ContentType "application/json" | Out-Null
    Write-Host "✅ Rate set" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

# Test 3: Check availability
Write-Host "`nTest 3: Checking availability..." -ForegroundColor Yellow
$checkIn = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$checkOut = (Get-Date).AddDays(3).ToString("yyyy-MM-dd")

try {
    $available = Invoke-RestMethod -Uri "$baseUrl/api/availability?checkIn=$checkIn&checkOut=$checkOut&adults=2&children=0" -Method Get
    Write-Host "✅ Found $($available.Count) available room(s)" -ForegroundColor Green
    Write-Host "   Total Price: R$ $($available[0].totalPrice)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Verify booking page URL
Write-Host "`nTest 4: Testing booking page URL..." -ForegroundColor Yellow
$bookingUrl = "$baseUrl/reservar?checkIn=$checkIn&checkOut=$checkOut&adults=2&children=0"
Write-Host "   URL: $bookingUrl" -ForegroundColor Cyan
Write-Host "✅ Open this URL in browser to test visually" -ForegroundColor Green

# Test 5: Create booking via API
Write-Host "`nTest 5: Creating booking..." -ForegroundColor Yellow
$bookingData = @{
    roomTypeId = $roomId
    checkIn = $checkIn
    checkOut = $checkOut
    totalPrice = 500
    guest = @{
        name = "João Teste"
        email = "joao@teste.com"
        phone = "11999999999"
    }
} | ConvertTo-Json

try {
    $booking = Invoke-RestMethod -Uri "$baseUrl/api/bookings" -Method Post -Body $bookingData -ContentType "application/json"
    Write-Host "✅ Booking created: $($booking.id)" -ForegroundColor Green
    Write-Host "   Status: $($booking.status)" -ForegroundColor Cyan
    $bookingId = $booking.id
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
    exit 1
}

# Test 6: Get booking
Write-Host "`nTest 6: Retrieving created booking..." -ForegroundColor Yellow
try {
    $bookings = Invoke-RestMethod -Uri "$baseUrl/api/bookings" -Method Get
    $ourBooking = $bookings | Where-Object { $_.id -eq $bookingId }
    if ($ourBooking) {
        Write-Host "✅ Booking found" -ForegroundColor Green
        Write-Host "   Guest: $($ourBooking.guest.name)" -ForegroundColor Cyan
        Write-Host "   Room: $($ourBooking.roomType.name)" -ForegroundColor Cyan
        Write-Host "   Total: R$ $($ourBooking.totalPrice)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Booking not found" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed: $_" -ForegroundColor Red
}

Write-Host "`n" -NoNewline
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "BOOKING FLOW TEST COMPLETE" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "`nNext: Open the URL above in your browser to test the UI!" -ForegroundColor Yellow
