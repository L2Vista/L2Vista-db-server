const mysql = require('mysql2/promise');

const dbConfig = require('../models/index');

async function dropDatabase() {
  const connection = await mysql.createConnection(dbConfig.config);

  try {
    const dbName = 'explorer';
    await connection.query(`DROP DATABASE ${dbName}`);
    console.log(`Database ${dbName} dropped successfully.`);
  } catch (error) {
    console.error('Error dropping database:', error);
  } finally {
    await connection.end();
  }
}

dropDatabase();