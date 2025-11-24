# Mercado Pago Integration - Tracking Errors Explained

## Summary

The `ERR_BLOCKED_BY_CLIENT` and `createCardToken` errors you're seeing in the console are **NOT actual payment errors**. They are tracking/analytics errors from Mercado Pago's SDK and do not affect the payment flow.

## What's Happening

Your application uses **Checkout Pro** (redirect-based payment), which works as follows:

1. User fills out booking form
2. Backend creates a payment "preference" via Mercado Pago API
3. User is **redirected** to Mercado Pago's hosted checkout page
4. **On that Mercado Pago page**, their SDK tries to send tracking data to `api.mercadolibre.com/tracks`
5. This tracking request gets blocked by browser privacy settings, ad blockers, or network policies
6. The error appears in console, but **payment still works**

## Why These Errors Don't Matter

- `createCardToken` is not used in your code (you use Checkout Pro, not Checkout Transparente)
- The errors are from Mercado Pago's internal tracking scripts
- They don't prevent payment processing
- They're cosmetic/telemetry only

## What Was Improved

To help you debug **real** payment issues (if any), I've added:

### Backend (`/api/mercadopago/create-preference`)
- ✅ Environment variable validation with detailed logging
- ✅ Better error messages from Mercado Pago API
- ✅ Success logging to confirm preference creation

### Frontend (`/reservar/page.tsx`)
- ✅ Step-by-step console logging of payment flow
- ✅ Better error handling and user feedback
- ✅ Detailed error messages from API responses

## How to Verify Payment Works

1. Open browser console (F12)
2. Go through booking flow
3. Look for logs starting with `[Payment Flow]` and `[MP]`
4. If you see "Redirecting to Mercado Pago..." → **it's working!**
5. The tracking errors can be safely ignored

## Environment Variables Needed

Make sure these are set in Vercel:

```
MP_ACCESS_TOKEN=your_mercadopago_access_token
NEXT_PUBLIC_MP_PUBLIC_KEY=your_public_key (optional for Checkout Pro)
NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
```

## Next Steps

1. Test the payment flow in production
2. Check the new console logs to confirm each step works
3. If you see any errors with `[Payment Flow]` or `[MP]` prefix, those are real issues to address
4. Ignore any `ERR_BLOCKED_BY_CLIENT` or `/tracks` errors - they're harmless
