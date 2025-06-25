# 🔧 Fix Railway Database Connection Issue

## The Problem
Your app is failing with: `Error: connect ECONNREFUSED ::1:5432`

This means the app can't connect to PostgreSQL because the database isn't configured.

## ✅ Solution - Add PostgreSQL to Railway

### Step 1: Add PostgreSQL Database
1. **Go to your Railway project dashboard**
2. **Click "+ New Service"**
3. **Select "Database"**
4. **Choose "Add PostgreSQL"**
5. **Wait for it to be created** (takes ~30 seconds)

### Step 2: Verify Environment Variables
Railway automatically creates these variables when you add PostgreSQL:
- `DATABASE_URL` - This is what your app needs!
- `PGDATABASE`
- `PGHOST`
- `PGPASSWORD`
- `PGPORT`
- `PGUSER`

### Step 3: Check Your App's Variables
1. **Click on your app service** (not the database)
2. **Go to "Variables" tab**
3. **Verify `DATABASE_URL` exists**
   - If it doesn't exist, Railway will create it automatically
   - If it exists but looks wrong, you can copy it from the PostgreSQL service

### Step 4: Redeploy
After adding PostgreSQL:
1. **Your app will automatically redeploy**
2. **Check the "Deployments" tab**
3. **Look for migration success messages**

## Expected Success Messages
When working correctly, you should see:
```
🔄 Running database migrations...
Running migration: 001_create_users.sql
✅ Completed migration: 001_create_users.sql
Running migration: 002_create_qr_codes.sql
✅ Completed migration: 002_create_qr_codes.sql
...
🎉 All migrations completed successfully!
```

## If It Still Fails

### Option A: Check Database Connection
1. **Go to PostgreSQL service in Railway**
2. **Click "Connect" tab**
3. **Copy the "Postgres Connection URL"**
4. **Go to your app service → Variables**
5. **Update `DATABASE_URL` with the copied URL**

### Option B: Manual Environment Variable
If Railway didn't create `DATABASE_URL` automatically:

1. **Get connection details from PostgreSQL service:**
   - Host: `your-db-host.railway.app`
   - Port: `5432`
   - Database: `railway`
   - Username: `postgres`
   - Password: `your-generated-password`

2. **Create `DATABASE_URL` manually:**
   ```
   postgresql://postgres:your-password@your-host.railway.app:5432/railway
   ```

## Quick Test
Once fixed, your app should start successfully and show:
- ✅ Database migrations completed
- ✅ Server running on port 3000
- ✅ All services connected

## Need Help?
If you're still having issues:
1. Share the Railway deployment logs
2. Check if PostgreSQL service is running (green status)
3. Verify the `DATABASE_URL` format is correct 