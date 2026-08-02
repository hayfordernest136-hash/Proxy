# Render + Railway Deployment Guide

## Prerequisites

1. A [Render](https://render.com) account
2. A [Railway](https://railway.app) account
3. A [Paystack](https://paystack.com) account with API keys
4. Your project pushed to GitHub

## Step 1: Create Railway MySQL Database

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Provision MySQL**
3. Wait for the database to be provisioned
4. Note the connection details:
   - `MYSQL_HOST` (e.g., `containers-us-west-xxx.railway.app`)
   - `MYSQL_PORT` (usually `3306`)
   - `MYSQL_USER` (usually `root`)
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE` (e.g., `railway`)

## Step 2: Deploy Backend to Render

### Create a Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:

   | Setting               | Value                          |
   | --------------------- | ------------------------------ |
   | **Name**              | `proxyzone-api`                |
   | **Root Directory**    | `server`                       |
   | **Runtime**           | `Node`                         |
   | **Build Command**     | `npm install && npm run build` |
   | **Start Command**     | `npm run start`                |
   | **Health Check Path** | `/api/health`                  |

### Environment Variables

Add these in the Render dashboard:

| Variable              | Value                                                |
| --------------------- | ---------------------------------------------------- |
| `NODE_ENV`            | `production`                                         |
| `PORT`                | `4000`                                               |
| `DB_HOST`             | Railway MySQL host                                   |
| `DB_PORT`             | `3306`                                               |
| `DB_USER`             | Railway MySQL user                                   |
| `DB_PASSWORD`         | Railway MySQL password                               |
| `DB_NAME`             | Railway MySQL database name                          |
| `JWT_SECRET`          | A strong random string (min 32 characters)           |
| `FRONTEND_URL`        | `https://proxyzone.onrender.com` (your frontend URL) |
| `PAYSTACK_SECRET_KEY` | Your Paystack secret key                             |
| `PAYSTACK_PUBLIC_KEY` | Your Paystack public key                             |

### After Deployment

- Note your backend URL: `https://proxyzone-api.onrender.com`

## Step 3: Deploy Frontend to Render

### Create a Web Service (SSR)

Since this is a TanStack Start SSR application (not a static site), it must be deployed as a **Web Service**.

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:

   | Setting            | Value                          |
   | ------------------ | ------------------------------ |
   | **Name**           | `proxyzone`                    |
   | **Root Directory** | (leave blank - use root)       |
   | **Runtime**        | `Node`                         |
   | **Build Command**  | `npm install && npm run build` |
   | **Start Command**  | `npm run start`                |

### Environment Variables

| Variable                   | Value                                |
| -------------------------- | ------------------------------------ |
| `NODE_ENV`                 | `production`                         |
| `VITE_API_BASE`            | `https://proxyzone-api.onrender.com` |
| `VITE_PAYSTACK_PUBLIC_KEY` | Your Paystack public key             |

> **⚠️ Important:** This is a Vite-built TanStack Start SSR app. The production runtime is served from `dist/`, so use `npm run start` (which launches `vite preview`) instead of `node .output/server/index.mjs`.

### After Deployment

- Note your frontend URL: `https://proxyzone.onrender.com`

## Step 4: Configure Paystack

1. Go to [Paystack Dashboard](https://dashboard.paystack.com)
2. Navigate to **Settings** → **API Keys & Webhooks**
3. Set the **Webhook URL** to:
   ```
   https://proxyzone-api.onrender.com/api/payments/webhook
   ```
4. Set the **Callback URL** to:
   ```
   https://proxyzone.onrender.com/_authenticated/checkout
   ```

## Step 5: Update Frontend CORS (if needed)

If you use a custom domain, update the `FRONTEND_URL` environment variable on the backend to match your custom domain.

## Step 6: Verify Deployment

1. Visit `https://proxyzone-api.onrender.com/api/health` - should return `{ "ok": true }`
2. Visit `https://proxyzone.onrender.com` - should load the frontend
3. Create an account and test the full flow

## Troubleshooting

### Backend won't start

- Check the Render logs for missing environment variables
- Ensure Railway MySQL is running and accessible
- Verify the `JWT_SECRET` is set

### Frontend can't reach backend

- Ensure `VITE_API_BASE` is set correctly on the frontend static site
- Ensure `FRONTEND_URL` on the backend matches the frontend URL
- Check CORS configuration

### Database connection issues

- Railway MySQL may have a different host/port
- Ensure the database is accessible from Render (check Railway network settings)
- The backend will retry the connection 5 times before failing

### Payment issues

- Verify Paystack keys are correct
- Ensure the webhook URL is accessible from Paystack
- Check Paystack webhook logs for delivery status
