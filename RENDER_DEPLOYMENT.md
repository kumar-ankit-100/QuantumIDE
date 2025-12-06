# Deploying QuantumIDE to Render

## Prerequisites

1. A [Render account](https://render.com) (free tier available)
2. GitHub repository connected to Render
3. Docker support on Render (requires paid plan for Docker deployments)

## Deployment Steps

### Option 1: Using Render Blueprint (Automated)

1. **Push your code to GitHub** (already done)
   ```bash
   git add .
   git commit -m "Add Render deployment configuration"
   git push origin main
   ```

2. **Create New Blueprint on Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository (`kumar-ankit-100/QuantumIDE`)
   - Render will automatically detect `render.yaml` and set up services

3. **Configure Environment Variables**
   - `NEXTAUTH_URL`: Set to your Render service URL (e.g., `https://quantumide.onrender.com`)
   - `NEXTAUTH_SECRET`: Auto-generated or set your own (use: `openssl rand -base64 32`)
   - `GITHUB_TOKEN`: Your GitHub Personal Access Token (optional)
   - `GOOGLE_API_KEY`: Your Google AI API key (optional)
   - `DATABASE_URL`: Auto-configured from PostgreSQL service

4. **Deploy**
   - Click "Apply" and Render will build and deploy your services
   - Database will be created automatically
   - Prisma migrations will run during build

### Option 2: Manual Setup

#### Step 1: Create PostgreSQL Database

1. Go to Render Dashboard → "New" → "PostgreSQL"
2. Name: `quantumide-db`
3. Database Name: `quantumide`
4. Region: Choose closest to your users
5. Plan: Starter (free) or higher
6. Click "Create Database"
7. Copy the "Internal Database URL" for later

#### Step 2: Create Web Service

1. Go to Render Dashboard → "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `quantumide`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: Starter or higher

#### Step 3: Configure Environment Variables

Add these in the "Environment" section:

```
NODE_ENV=production
DATABASE_URL=[paste your Internal Database URL]
NEXTAUTH_SECRET=[generate with: openssl rand -base64 32]
NEXTAUTH_URL=https://quantumide.onrender.com
GITHUB_TOKEN=[your GitHub token - optional]
GOOGLE_API_KEY=[your Google AI key - optional]
```

#### Step 4: Deploy

1. Click "Create Web Service"
2. Render will build the Docker image and deploy
3. Build time: ~5-10 minutes
4. Access your app at: `https://quantumide.onrender.com`

## Important Notes

### Docker Socket Access

**⚠️ CRITICAL LIMITATION**: Render's standard Docker environment does not provide access to the Docker socket (`/var/run/docker.sock`), which is required for QuantumIDE to create and manage user containers.

**Solutions:**

1. **Use Render's Native Environments** (Recommended Alternative)
   - Deploy each user project as a separate Render service
   - Use Render API to create/manage services programmatically
   - Modify container manager to use Render API instead of Docker

2. **Switch to Docker-Enabled Platform**
   - AWS ECS/EKS: Full Docker support
   - Google Cloud Run: Container orchestration
   - DigitalOcean App Platform: Docker support
   - Self-hosted VPS: Full control

3. **Hybrid Approach**
   - Host main application on Render
   - Use external Docker host for containers
   - Configure `DOCKER_HOST` to point to remote Docker daemon

### Database Migrations

Migrations run automatically during build:
```bash
npx prisma generate
npx prisma migrate deploy
```

### Automatic Deployments

- Enabled by default on `main` branch
- Push to GitHub triggers automatic redeploy
- Build takes ~5-10 minutes

### Health Checks

- Path: `/` (landing page)
- Render automatically monitors service health
- Auto-restart on failure

### Logs

View logs in real-time:
- Render Dashboard → Your Service → Logs tab
- Filter by: Info, Warn, Error

## Post-Deployment

### 1. Update NEXTAUTH_URL

After deployment, update `NEXTAUTH_URL` in environment variables:
```
NEXTAUTH_URL=https://your-service-name.onrender.com
```

### 2. Test Authentication

- Visit your deployed URL
- Register a new account
- Create a test project
- Verify functionality

### 3. Configure Custom Domain (Optional)

1. Go to service Settings → Custom Domain
2. Add your domain
3. Update DNS records as shown
4. Update `NEXTAUTH_URL` to use custom domain

## Troubleshooting

### Build Fails

- Check build logs for errors
- Verify all environment variables are set
- Ensure `DATABASE_URL` is correct

### Database Connection Error

- Verify `DATABASE_URL` includes `?sslmode=require`
- Check database is in same region
- Ensure Prisma migrations completed

### Application Crashes

- Check service logs for errors
- Verify environment variables
- Check disk space usage

### Container Creation Fails

- **Expected on Render**: Docker socket not available
- Implement alternative using Render API
- Or switch to Docker-enabled platform

## Cost Estimate

### Free Tier
- Web Service: Free (with 750 hours/month, sleeps after inactivity)
- PostgreSQL: Free (1GB storage, limited connections)

### Paid Plans
- Starter: $7/month (web service)
- Starter Plus: $25/month (always on)
- PostgreSQL Starter: $7/month
- Standard: $25/month (recommended for production)

## Recommended Production Setup

For full QuantumIDE functionality with Docker container support, consider:

1. **AWS EC2 + Docker** - Full control, Docker socket access
2. **DigitalOcean Droplet** - Simple VPS with Docker
3. **Google Cloud Compute Engine** - Scalable with Docker
4. **Self-hosted VPS** - Maximum flexibility

## Alternative: Deploy to AWS/DigitalOcean

If Docker socket access is required, see:
- [AWS Deployment Guide](./AWS_DEPLOYMENT.md) (to be created)
- [DigitalOcean Deployment Guide](./DO_DEPLOYMENT.md) (to be created)

## Support

For issues specific to Render deployment:
- [Render Documentation](https://render.com/docs)
- [Render Community Forum](https://community.render.com)
- GitHub Issues: [QuantumIDE Repository](https://github.com/kumar-ankit-100/QuantumIDE/issues)
