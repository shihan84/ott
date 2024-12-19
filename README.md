# OTT Platform

Enterprise-grade video streaming management platform designed for media professionals to monitor, optimize, and analyze live streaming infrastructure.

## Features

- HLS streaming functionality
- Real-time stream status indicators
- Advanced cross-server analytics
- Thumbnail generation
- User authentication and access control
- Performance monitoring
- Traffic analytics

## Prerequisites

- Ubuntu 22.04 or 20.04 (recommended) or compatible Linux distribution
- Node.js v20 or later
- PostgreSQL database
- FFmpeg (for thumbnail generation)

## Quick Installation

1. Clone the repository:
```bash
git clone https://github.com/shihan84/ott.git
cd ott
```

2. Set up your environment variables in .env file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PGDATABASE=dbname
PGHOST=localhost
PGUSER=user
PGPASSWORD=password
PGPORT=5432
```

3. Run the installation script:
```bash
chmod +x deploy/install.sh
./deploy/install.sh
```

The script will:
- Install required system dependencies (Node.js, FFmpeg, PostgreSQL)
- Set up the database
- Install Node.js dependencies
- Initialize the schema
- Create necessary directories
- Build the application

4. Start the application:
```bash
# For development
npm run dev

# For production
npm start
```

The application will be available at http://localhost:5000

## Manual Installation

If you prefer to install components manually:

1. Install system dependencies:
```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Initialize database:
```bash
npm run db:push
```

4. Create required directories:
```bash
mkdir -p public/thumbnails
```

5. Start the application:
```bash
npm run dev
```

## Development

- Frontend: React.js with Vite
- Backend: Node.js
- Database: PostgreSQL
- ORM: Drizzle
- Authentication: Multi-factor with granular access controls
- Media Server: Flussonic integration
- Stream Player: HLS with React Player

For detailed development guidelines, check `deploy/README.md`.

## License

MIT
