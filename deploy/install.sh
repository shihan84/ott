#!/bin/bash

# Print commands and exit on error
# Check system requirements
check_system_requirements() {
    print_status "Checking system requirements..."
    
    # Check available disk space (minimum 2GB)
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 2 ]; then
        print_error "Insufficient disk space. At least 2GB of free space is required."
        print_error "Available space: ${AVAILABLE_SPACE}GB"
        exit 1
    fi
    print_status "Disk space check passed (${AVAILABLE_SPACE}GB available)"
    
    # Check available memory (minimum 1GB)
    AVAILABLE_MEMORY=$(free -g | awk '/^Mem:/ {print $2}')
    if [ "$AVAILABLE_MEMORY" -lt 1 ]; then
        print_error "Insufficient memory. At least 1GB of RAM is required."
        print_error "Available memory: ${AVAILABLE_MEMORY}GB"
        exit 1
    fi
    print_status "Memory check passed (${AVAILABLE_MEMORY}GB available)"

    # Check CPU cores (minimum 2)
    CPU_CORES=$(nproc)
    if [ "$CPU_CORES" -lt 2 ]; then
        print_warning "Low CPU core count detected: ${CPU_CORES}"
        print_warning "Performance may be impacted"
    else
        print_status "CPU check passed (${CPU_CORES} cores available)"
    fi
    
    print_status "All system requirement checks passed successfully"
}

set -ex
# Error handling
handle_error() {
    local exit_code=$1
    local error_message=$2
    if [ $exit_code -ne 0 ]; then
        echo "Error: $error_message"
        echo "Installation failed. Please check the error message above."
        exit $exit_code
    fi
}


echo "Starting OTT Platform Installation..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get Ubuntu version
# Cleanup function
cleanup() {
    echo "
Cleaning up..."
    # Remove partial installations if they exist
    if [ -d "node_modules" ]; then
        rm -rf node_modules
    fi
    if [ -d "dist" ]; then
        rm -rf dist
    fi
    echo "Cleanup completed."
}

# Set up trap to catch interrupts and cleanup
trap cleanup EXIT INT TERM

get_ubuntu_version() {
    if [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        echo "$DISTRIB_RELEASE"
    else
        echo "unknown"
    fi
}

# Check Ubuntu version
UBUNTU_VERSION=$(get_ubuntu_version)
echo "Detected Ubuntu version: $UBUNTU_VERSION"

if [[ "$UBUNTU_VERSION" != "22.04" && "$UBUNTU_VERSION" != "20.04" ]]; then
    echo "Warning: This script is tested on Ubuntu 22.04 and 20.04. Your version is $UBUNTU_VERSION."
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check prerequisites
echo "Checking prerequisites..."

# Check system requirements before proceeding
check_system_requirements

# Install basic requirements
echo "Installing basic requirements..."
sudo apt-get update
handle_error $? "Failed to update package list"

sudo apt-get install -y curl software-properties-common apt-transport-https ca-certificates gnupg
handle_error $? "Failed to install basic requirements"

# Check for Node.js
if ! command_exists node; then
    echo "Node.js is not installed. Installing Node.js 20..."
    # Remove any existing Node.js repositories
    sudo rm -f /etc/apt/sources.list.d/nodesource.list*
    # Add NodeSource repository for Ubuntu
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify Node.js installation
    NODE_VERSION=$(node --version)
    echo "Node.js version installed: $NODE_VERSION"
fi

# Check for FFmpeg
if ! command_exists ffmpeg; then
    echo "FFmpeg is not installed. Installing FFmpeg..."
    sudo apt-get update
    sudo apt-get install -y ffmpeg
    
    # Verify FFmpeg installation
    FFMPEG_VERSION=$(ffmpeg -version | head -n1)
    echo "FFmpeg version installed: $FFMPEG_VERSION"
fi

# Check for PostgreSQL
if ! command_exists psql; then
    echo "PostgreSQL is not installed. Installing PostgreSQL..."
    # Add PostgreSQL repository for Ubuntu
    UBUNTU_CODENAME=$(lsb_release -cs)
    echo "deb http://apt.postgresql.org/pub/repos/apt/ ${UBUNTU_CODENAME}-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
fi

echo "Setting up PostgreSQL database..."
if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL environment variable is not set"
    echo "Please set up your database configuration in .env file"
    echo "Example:"
    echo "DATABASE_URL=postgresql://user:password@localhost:5432/ott_db"
    echo "PGDATABASE=ott_db"
    echo "PGHOST=localhost"
    echo "PGUSER=your_user"
    echo "PGPASSWORD=your_password"
    echo "PGPORT=5432"
    exit 1
fi

echo "Installing Node.js dependencies..."
npm install

echo "Creating required directories..."
mkdir -p public/thumbnails

echo "Initializing database schema..."
npm run db:push

echo "Building the application..."
npm run build

echo "Installation completed successfully!"
echo "To start the application in development mode, run: npm run dev"
echo "To start the application in production mode, run: npm start"

# Add basic health check
echo "Verifying installation..."
# Verify Node.js and npm
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
# Verify FFmpeg
echo "FFmpeg: $(ffmpeg -version | head -n1)"
# Verify PostgreSQL
echo "PostgreSQL: $(psql --version)"

# Check if the application is running
curl -f http://localhost:5000/api/health || echo "Note: Application is not running yet. Start it with npm run dev"

# Print installation summary
echo "
Installation Summary:
-------------------"
echo "Node.js Version: $(node --version)"
echo "npm Version: $(npm --version)"
echo "FFmpeg Version: $(ffmpeg -version | head -n1)"
echo "PostgreSQL Version: $(psql --version)"
echo "
Installed Directories:
- node_modules/ ($(du -sh node_modules 2>/dev/null | cut -f1))"
echo "- public/thumbnails/"
echo "
Next Steps:
1. Start development server: npm run dev
2. Start production server: npm start
3. Access the application at: http://localhost:5000

Installation completed successfully!
"

# Add colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored status messages
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}