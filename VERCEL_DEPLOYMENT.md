# 🚀 TipJar Vercel Deployment Guide

This guide will help you deploy your TipJar application to Vercel with your Gemini API key.

## 📋 Prerequisites

- GitHub account
- Vercel account (free)
- Your Gemini API key: `AIzaSyDpCDUUu60xIvr6-fB810rqKhffG7nhAyQ`

## 🔧 Step 1: Prepare Your Code

Your code is already configured for Vercel deployment with:
- ✅ `vercel.json` configuration file
- ✅ API functions in `/api` directory
- ✅ Updated build scripts
- ✅ Vite config optimized for Vercel

## 📚 Step 2: Push to GitHub

1. **Create a new GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for Vercel deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tipjar-app.git
   git push -u origin main
   ```

2. **Or push to existing repository**:
   ```bash
   git add .
   git commit -m "Configure for Vercel deployment"
   git push
   ```

## 🌐 Step 3: Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "New Project"**
3. **Import your GitHub repository**
4. **Configure the project**:
   - Framework Preset: **Vite**
   - Root Directory: **./client**
   - Build Command: `npm run build:vercel`
   - Output Directory: `dist`

## 🔑 Step 4: Set Environment Variables

In your Vercel project dashboard:

1. **Go to Settings → Environment Variables**
2. **Add these variables**:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `GEMINI_API_KEY` | `AIzaSyDpCDUUu60xIvr6-fB810rqKhffG7nhAyQ` | Production, Preview, Development |
   | `SESSION_SECRET` | `your-random-32-character-string` | Production, Preview, Development |
   | `DATABASE_URL` | `your-database-connection-string` | Production, Preview, Development |

3. **Generate SESSION_SECRET**:
   ```bash
   # Run this in your terminal to generate a secure session secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## 🗄️ Step 5: Set Up Database

### Option A: Neon (Recommended - Free PostgreSQL)

1. **Go to [neon.tech](https://neon.tech)** and create account
2. **Create a new project**
3. **Copy the connection string** (looks like: `postgresql://user:pass@host/dbname?sslmode=require`)
4. **Add it as `DATABASE_URL` in Vercel**

### Option B: Vercel Postgres (Alternative)

1. **In your Vercel project, go to Storage**
2. **Create → Postgres**
3. **Connect to your project**
4. **Environment variables will be added automatically**

## 🎯 Step 6: Deploy

1. **Click "Deploy"** in Vercel
2. **Wait for build to complete** (~2-3 minutes)
3. **Your app will be live** at `https://your-project-name.vercel.app`

## 🔧 Step 7: Run Database Migrations

After deployment:

1. **In your Vercel project dashboard**
2. **Go to Functions → View Function Logs**
3. **Or run locally and push schema**:
   ```bash
   npm run db:push
   ```

## ✅ Verification Checklist

- [ ] App loads at your Vercel URL
- [ ] OCR functionality works (upload an image)
- [ ] Partner management works
- [ ] Calculations work correctly
- [ ] History saves and loads

## 🚨 Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify build command is correct
- Check Vercel build logs

### API Functions Error
- Verify environment variables are set
- Check function logs in Vercel dashboard
- Ensure database is accessible

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check database allows connections from Vercel IPs
- Test connection string locally first

## 🎉 Success!

Your TipJar app is now deployed on Vercel with:
- ✅ Free hosting
- ✅ Automatic deployments from GitHub
- ✅ Environment variables secured
- ✅ Scalable serverless functions
- ✅ CDN-optimized static assets

**Your live app:** `https://your-project-name.vercel.app`

---

## 📞 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables
3. Test API endpoints directly
4. Check database connectivity

Your Gemini API key is safely stored in Vercel's environment variables and will not be exposed in your code.