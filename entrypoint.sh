#!/bin/bash
set -e

# Initialize MariaDB data directory if not already initialized
if [ ! -d "/var/lib/mysql/mysql" ]; then
    echo "Initializing MariaDB data directory..."
    mysql_install_db --user=mysql --datadir=/var/lib/mysql
fi

# Start MariaDB in the background
echo "Starting MariaDB..."
mysqld_safe --user=mysql --datadir=/var/lib/mysql &

# Wait for MariaDB to be ready
echo "Waiting for MariaDB to start..."
until mariadb-admin ping >/dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo "MariaDB is up and running!"

# Set root password if provided in environment
if [ ! -z "$DB_PASSWORD" ]; then
    echo "Setting MariaDB root password..."
    mariadb -e "ALTER USER 'root'@'192.168.145.122' IDENTIFIED BY '$DB_PASSWORD'; FLUSH PRIVILEGES;"
fi

# Start the Node.js application
echo "Starting application..."
npm run server

