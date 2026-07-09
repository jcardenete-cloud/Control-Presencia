import mariadb from 'mariadb';
import dotenv from 'dotenv';

dotenv.config();

const cfg = {
  host: process.env.DB_HOST || '192.168.145.122',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || undefined,
  connectTimeout: 5000
};

async function test() {
  console.log('DB test config:', { host: cfg.host, user: cfg.user, database: cfg.database });
  try {
    const conn = await mariadb.createConnection({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectTimeout: cfg.connectTimeout
    });

    console.log('Connected to database, running simple query...');
    const res = await conn.query('SELECT 1 AS ok');
    console.log('Query result:', res);
    await conn.end();
    console.log('Connection closed successfully.');
  } catch (err) {
    console.error('Connection failed. Error details:');
    console.error(err);
    // Print helpful hints
    console.log('\nHints:');
    console.log('- Verify the host is reachable: ping', cfg.host);
    console.log("- From PowerShell run: Test-NetConnection -ComputerName <host> -Port 3306");
    console.log('- Check DB user/password and that MariaDB is listening on TCP on the configured IP');
    console.log('- If DB runs on another machine, ensure firewall allows inbound 3306');
    console.log('- Check MySQL/MariaDB `bind-address` in my.cnf/my.ini (should not be 127.0.0.1 only)');
  }
}

test();
