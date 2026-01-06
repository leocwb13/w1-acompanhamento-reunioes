# Stripe Integration Setup Guide

This guide will help you configure Stripe payment integration for your application.

## Prerequisites

- Stripe account (create one at https://stripe.com if needed)
- Supabase project with edge functions deployed
- Access to Stripe Dashboard

## Step 1: Get Your Stripe API Keys

1. Log in to your Stripe Dashboard at https://dashboard.stripe.com
2. Click on **Developers** in the left sidebar
3. Click on **API keys**
4. You'll see two keys:
   - **Publishable key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)
   - **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)
5. Copy both keys - you'll need them in the next steps

## Step 2: Configure Environment Variables

### In Your Supabase Project

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** > **Edge Functions**
3. Under "Secrets", add the following environment variables:
   - `STRIPE_SECRET_KEY`: Your Stripe secret key (sk_test_... or sk_live_...)

### In Your Local .env File

Add the following to your `.env` file:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

## Step 3: Get Your Webhook Endpoint URL

Your Supabase edge function webhook URL will be:

```
https://[YOUR_PROJECT_ID].supabase.co/functions/v1/stripe-webhook
```

To find your project ID:
1. Go to your Supabase dashboard
2. Look at the URL or check **Project Settings** > **General**
3. Your project reference ID is shown there

Example webhook URL:
```
https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook
```

## Step 4: Configure Stripe Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. In the "Endpoint URL" field, paste your webhook URL from Step 3
4. Under "Events to send", click **Select events**
5. Select the following events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
6. Click **Add events**
7. Click **Add endpoint** to save

## Step 5: Get Your Webhook Signing Secret

After creating the webhook endpoint:

1. Click on the webhook endpoint you just created
2. Under "Signing secret", click **Reveal**
3. Copy the signing secret (starts with `whsec_`)
4. Go back to your Supabase project
5. Navigate to **Project Settings** > **Edge Functions**
6. Add a new secret:
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: Your webhook signing secret (whsec_...)

## Step 6: Create Your Stripe Products

1. Go to https://dashboard.stripe.com/products
2. Click **+ Add product**
3. Configure your Pro plan:
   - **Name**: Pro Plan (or your preferred name)
   - **Description**: Unlimited meetings and advanced features
   - **Pricing**: Set your price (e.g., R$ 74.95)
   - **Billing period**: Recurring monthly
4. Click **Save product**
5. Copy the **Price ID** (starts with `price_`)
6. Update `/tmp/cc-agent/58509805/project/src/stripe-config.ts` with your actual product and price IDs

## Step 7: Update Your Database Plans

The application needs to match Stripe price IDs to database plans:

1. In your database, ensure your plans table has the correct data
2. The migration should have already created:
   - Free plan (R$ 0, 3 credits/month)
   - Pro plan (R$ 74.95, unlimited credits)
3. Link your Stripe price ID to the Pro plan in the code

## Step 8: Test Your Integration

### Test Mode Testing

1. Use Stripe test cards: https://stripe.com/docs/testing
2. Recommended test card: `4242 4242 4242 4242`
   - Use any future expiry date
   - Use any 3-digit CVC
   - Use any ZIP code
3. Make a test purchase
4. Verify the webhook is received in Stripe Dashboard > Developers > Webhooks
5. Check that the subscription was created in your database

### Test Webhook Delivery

1. Go to https://dashboard.stripe.com/webhooks
2. Click on your webhook endpoint
3. Click **Send test webhook**
4. Select `checkout.session.completed`
5. Click **Send test webhook**
6. Check the response - it should be 200 OK

## Step 9: Go Live

When you're ready to go live:

1. In Stripe Dashboard, toggle from **Test mode** to **Live mode** (top right)
2. Get your live API keys (pk_live_... and sk_live_...)
3. Create a new webhook endpoint for production using your production URL
4. Get the new live webhook signing secret
5. Update your environment variables with live keys
6. Update your Supabase secrets with live keys
7. Test with a real (small amount) transaction

## Important Security Notes

- **NEVER** commit your secret keys to git
- **NEVER** expose your webhook signing secret
- Keep test and live keys separate
- Use environment variables for all sensitive data
- Regularly rotate your API keys for security

## Troubleshooting

### Webhook Not Receiving Events

1. Check that your edge function is deployed
2. Verify the webhook URL is correct
3. Check Stripe Dashboard > Webhooks for error messages
4. Verify STRIPE_WEBHOOK_SECRET is set correctly
5. Check Supabase edge function logs

### Payment Not Creating Subscription

1. Check that the plan_id in the checkout session metadata matches your database
2. Verify the webhook handler is processing checkout.session.completed
3. Check your database for the subscription record
4. Look at Supabase logs for errors

### "Invalid API Key" Errors

1. Verify you're using the correct key for the mode (test vs live)
2. Check that STRIPE_SECRET_KEY is set in Supabase
3. Ensure the key hasn't been deleted or rotated in Stripe

## Support Resources

- Stripe Documentation: https://stripe.com/docs
- Stripe Testing: https://stripe.com/docs/testing
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Webhook Testing: https://stripe.com/docs/webhooks/test

## Quick Reference

### Environment Variables Needed

**Supabase Secrets (Server-side):**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret

**Local .env (Client-side):**
- `VITE_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key

### Webhook Events to Subscribe

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Test Cards

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

Any future expiry, any CVC, any ZIP
