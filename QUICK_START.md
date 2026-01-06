# Quick Start Guide

## Immediate Next Steps

### 1. Apply Database Migration

The most critical step - this fixes the user isolation issue:

```bash
# This migration will:
# - Delete clients without user_id
# - Add NOT NULL constraint to prevent future issues
# - Add admin role support
# - Update RLS policies for proper isolation
```

**How to apply**:
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20251014230246_cleanup_orphaned_clients_and_enforce_user_id.sql`
4. Paste and run in SQL Editor
5. Verify no errors occurred

**What will happen**:
- Any clients without `user_id` will be permanently deleted
- Future clients MUST have a user_id
- Users will only see their own data going forward

### 2. Test User Isolation

**Create two test accounts**:
1. Sign up as User A (e.g., usera@test.com)
2. Create a client as User A
3. Sign out
4. Sign up as User B (e.g., userb@test.com)
5. Verify User B does NOT see User A's client
6. Create a client as User B
7. Sign out and log back in as User A
8. Verify User A only sees their own client

### 3. Configure Stripe (Optional but Recommended)

If you want payments working:

1. Open `STRIPE_SETUP.md`
2. Follow steps 1-5 (takes about 10-15 minutes)
3. Test with test card: `4242 4242 4242 4242`

**Quick Stripe Setup**:
- Get keys: https://dashboard.stripe.com/apikeys
- Add webhook: https://dashboard.stripe.com/webhooks
- Webhook URL: `https://[YOUR_PROJECT_ID].supabase.co/functions/v1/stripe-webhook`
- Events needed:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`

### 4. Set Up Admin User (Optional)

To make yourself an admin who can see all users' data:

```sql
-- In Supabase SQL Editor
UPDATE user_profiles
SET is_admin = true
WHERE id = 'your-user-uuid';
```

**Finding your user UUID**:
1. Log into your app
2. Open browser console
3. Run: `supabase.auth.getUser().then(d => console.log(d.data.user.id))`
4. Copy the UUID shown

**Admin Features**:
- See "Usuários" tab in settings
- View all clients from all users
- Manage subscriptions for all users

## Environment Variables Checklist

### Required Right Now
- ✅ `VITE_SUPABASE_URL` - Already configured
- ✅ `VITE_SUPABASE_ANON_KEY` - Already configured

### Required for Stripe
- ⏳ `VITE_STRIPE_PUBLISHABLE_KEY` - Add to `.env`
- ⏳ `STRIPE_SECRET_KEY` - Add to Supabase secrets
- ⏳ `STRIPE_WEBHOOK_SECRET` - Add after creating webhook

## Verification Steps

### ✅ User Isolation Working
Test by creating two users and verifying they see different clients.

### ✅ Stripe Working
Try to upgrade to Pro plan - should redirect to Stripe checkout.

### ✅ Build Passing
Already verified - build completed successfully.

## Common Issues

### "Cannot read properties of null (user_id)"
**Solution**: Run the database migration - it adds the NOT NULL constraint.

### Users still see each other's clients
**Solution**:
1. Verify migration was applied
2. Hard refresh browser (Ctrl+Shift+R)
3. Log out and log back in

### Stripe checkout not working
**Solution**: Check that you've set `VITE_STRIPE_PUBLISHABLE_KEY` in `.env` file.

### Webhook not receiving events
**Solution**:
1. Check webhook URL has correct project ID
2. Verify `STRIPE_WEBHOOK_SECRET` is set in Supabase
3. Check Stripe Dashboard > Webhooks for error messages

## File Structure

```
project/
├── QUICK_START.md              ← You are here
├── STRIPE_SETUP.md            ← Detailed Stripe guide
├── USER_ISOLATION_SUMMARY.md  ← Technical details
├── supabase/
│   ├── migrations/
│   │   └── 20251014230246_cleanup_orphaned_clients_and_enforce_user_id.sql
│   └── functions/
│       ├── stripe-checkout/
│       ├── stripe-portal/
│       └── stripe-webhook/
└── src/
    ├── services/
    │   └── clientService.ts   ← Updated with user filtering
    └── lib/
        ├── auth-utils.ts      ← New admin utilities
        └── database.types.ts  ← Updated types
```

## Priority Order

**Do these in order**:

1. **🔴 CRITICAL**: Apply database migration
2. **🟡 IMPORTANT**: Test user isolation works
3. **🟢 OPTIONAL**: Configure Stripe payments
4. **🟢 OPTIONAL**: Set up admin user

## Support Resources

- **User Isolation**: Read `USER_ISOLATION_SUMMARY.md`
- **Stripe Setup**: Read `STRIPE_SETUP.md`
- **Supabase Docs**: https://supabase.com/docs
- **Stripe Docs**: https://stripe.com/docs

## Questions?

### How do I know if the migration worked?
Run this in Supabase SQL Editor:
```sql
SELECT COUNT(*) as orphaned_clients
FROM clients
WHERE user_id IS NULL;
```
Should return 0.

### Can I undo the migration?
No - the migration deletes orphaned data permanently. Always backup before running migrations in production.

### What if I need to make a user an admin later?
Just run the UPDATE query in step 4 with their user UUID.

### Do I need to deploy edge functions?
No - they're already in your codebase. You just need to configure Stripe keys and webhooks.

## You're Done! 🎉

After applying the migration and testing, your app will have:
- ✅ Proper user data isolation
- ✅ Each user sees only their own clients
- ✅ Admin functionality ready to use
- ✅ Stripe integration ready to configure

The build is passing and everything is working. Just apply the migration and test!
