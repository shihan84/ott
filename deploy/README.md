# Deployment Guide

## Prerequisites
- Node.js v20 or later
- PostgreSQL database
- A VPS with a control panel
- FFmpeg (for thumbnail generation)

## Step 1: Initial Server Setup

1. Install Node.js v20:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. Install FFmpeg:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

3. Install PostgreSQL:
```bash
sudo apt-get install -y postgresql postgresql-contrib
```

## Step 2: Database Setup

1. Create a PostgreSQL database and user:
```sql
sudo -u postgres psql

CREATE DATABASE streammonitor;
CREATE USER streamuser WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE streammonitor TO streamuser;
\q
```

2. Set up environment variables in your control panel or create a `.env` file:
```env
DATABASE_URL=postgresql://streamuser:your_password@localhost:5432/streammonitor
PGDATABASE=streammonitor
PGHOST=localhost
PGUSER=streamuser
PGPASSWORD=your_password
PGPORT=5432
```

## Step 3: Application Deployment

1. Create application directory:
```bash
mkdir -p /var/www/streammonitor
cd /var/www/streammonitor
```

2. Upload your application files using SFTP/SCP or git clone

3. Install dependencies:
```bash
npm install
```

4. Build the application:
```bash
npm run build
```

5. Set up the database schema:
```bash
npm run db:push
```

## Step 4: Running in Production

1. Install PM2 for process management:
```bash
sudo npm install -g pm2
```

2. Start the application:
```bash
pm2 start npm --name "streammonitor" -- start
pm2 startup
pm2 save
```

## Step 5: Nginx Configuration

1. Install Nginx:
```bash
sudo apt-get install -y nginx
```

2. Create Nginx configuration file `/etc/nginx/sites-available/streammonitor`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Serve thumbnails with caching
    location /thumbnails {
        alias /var/www/streammonitor/public/thumbnails;
        expires 1h;
        add_header Cache-Control "public, no-transform";
    }
}
```

3. Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/streammonitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: SSL Configuration (Recommended)

1. Install Certbot:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

2. Obtain SSL certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

## Monitoring and Maintenance

1. View application logs:
```bash
pm2 logs streammonitor
```

2. Monitor application status:
```bash
pm2 status
```

3. Update application:
```bash
git pull  # if using git
npm install
npm run build
pm2 restart streammonitor
```

## Health Check
The application provides a health check endpoint at `/api/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "ISO date string",
  "uptime": "seconds"
}
```

## Troubleshooting

### Stream Issues
- Check firewall settings: `sudo ufw status`
- Verify FFmpeg installation: `ffmpeg -version`
- Test stream URLs directly using `ffmpeg` or `curl`
- Check application logs: `pm2 logs streammonitor`

### Database Issues
- Verify PostgreSQL service: `sudo systemctl status postgresql`
- Check database connection: `psql -U streamuser -d streammonitor`
- Review database logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`

### Application Issues
- Memory usage: `pm2 monit`
- Disk space: `df -h`
- Node.js version: `node --version`
- Dependencies: `npm ls`

### Security Notes
- Keep Node.js, FFmpeg, and system packages updated
- Use strong database passwords
- Enable and configure firewall (ufw)
- Regularly backup your database
- Monitor server resources and logs
