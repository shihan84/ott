# Deployment Guide

## Prerequisites
- Node.js v20 or later
- PostgreSQL database
- A VPS with a control panel

## Environment Variables
The following environment variables must be set:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PGDATABASE=your_database_name
PGHOST=your_database_host
PGUSER=your_database_user
PGPASSWORD=your_database_password
PGPORT=5432
```

## Build Steps

1. Install dependencies:
```bash
npm install
```

2. Build the frontend and backend:
```bash
npm run build
```

3. Set up the database:
```bash
npm run db:push
```

4. Start the production server:
```bash
npm run start
```

## Production Server Configuration

The server will run on port 5000 by default. You can configure your control panel or reverse proxy to forward traffic to this port.

### Nginx Configuration Example
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
    }
}
```

## Database Migration
The project uses Drizzle ORM for database management. After deployment:

1. Ensure your database connection string is set in the environment variables
2. Run `npm run db:push` to update your database schema

## Health Check
The server provides a health check endpoint at `/api/health` that you can use to monitor the application status.

## Troubleshooting

### Stream Issues
- Ensure your VPS firewall allows outbound connections to stream sources
- Check the logs for any connection errors to the streaming servers
- Verify that the HLS stream URLs are correctly constructed

### Database Issues
- Verify PostgreSQL is running and accessible
- Check database connection string format
- Ensure database user has proper permissions

### Common Issues
1. If the application fails to start:
   - Check if port 5000 is available
   - Verify all environment variables are set
   - Check the application logs for errors

2. If streams don't play:
   - Verify the stream source URLs are accessible from your VPS
   - Check browser console for CORS or mixed content errors
   - Ensure proper SSL/TLS configuration if using HTTPS
