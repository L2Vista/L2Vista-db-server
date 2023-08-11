const {
  ethers
} = require('hardhat');
const mysql = require('mysql2/promise');

const chainInfo = require("../config/chainInfo");
const dbConfig = require('../models/index');

const tableName = "mode_ccip";

let connection;
let provider;
let contractAddr;

async function attach() {
  // Setup Database
  connection = await mysql.createConnection(dbConfig.config);

  const createDbSql = `CREATE DATABASE IF NOT EXISTS ${dbConfig.dbName}`;
  await connection.execute(createDbSql);

  await connection.end();

  // Setup table
  connection = await mysql.createConnection({
    ...dbConfig.config,
    database: dbConfig.dbName,
  });

  const createTableSql_lastBlocks = `CREATE TABLE IF NOT EXISTS ${dbConfig.schema.lastBlocksConfig.tableName} (${dbConfig.schema.lastBlocksConfig.tableSchema})`;
  await connection.execute(createTableSql_lastBlocks);
  const createTableSql_fromTx = `CREATE TABLE IF NOT EXISTS ${dbConfig.schema.fromTxConfig.tableName} (${dbConfig.schema.fromTxConfig.tableSchema})`;
  await connection.execute(createTableSql_fromTx);
  const createTableSql_toTx = `CREATE TABLE IF NOT EXISTS ${dbConfig.schema.toTxConfig.tableName} (${dbConfig.schema.toTxConfig.tableSchema})`;
  await connection.execute(createTableSql_toTx);

  provider = new ethers.providers.JsonRpcProvider(chainInfo.mode.url);
  contractAddr = chainInfo.mode.ccipAddr;
}

// Utility function for sleeping
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getLastBlock() {
  try {
    const [rows, fields] = await connection.execute(`SELECT MAX(blockNumber) as lastBlock FROM lastBlocks WHERE tableName = "${tableName}"`);
    return rows[0].lastBlock || 0;
  } catch (err) {
    console.error('Error: ', err);
  }
}

async function updateLastBlock(endBlock) {
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM lastBlocks WHERE tableName = ?',
      [tableName]
    );

    if (rows.length > 0) {
      // If the tableName exists, update the blockNumber
      await connection.execute(
        'UPDATE lastBlocks SET blockNumber = ? WHERE tableName = ?',
        [endBlock, tableName]
      );
    } else {
      // If the tableName does not exist, insert a new record
      await connection.execute(
        'INSERT INTO lastBlocks (tableName, blockNumber) VALUES (?, ?)',
        [tableName, endBlock]
      );
    }
  } catch (err) {
    console.error('Error: ', err);
  }
}

async function insertData(tableName, columns, params) {

  // build column names for SQL statement
  const columnNames = columns.join(', ');
  // build a string with the correct number of placeholders
  const placeholders = new Array(columns.length).fill('?').join(', ');

  const sql = `
  INSERT IGNORE INTO ${tableName} (${columnNames}) 
  VALUES (${placeholders})`;

  try {
    const [rows, fields] = await connection.execute(sql, params);
    console.log(`Inserted ${rows.affectedRows} row(s).`);
  } catch (err) {
    console.error('Error: ', err);
  }
};

function extractColumnNames(schemaString) {
  const regex = /\s(\w+)\s.+/g;
  let match;
  let columnNames = [];

  while ((match = regex.exec(schemaString)) !== null) {
    columnNames.push(match[1]);
  }

  // 제거할 컬럼
  const excludedColumns = [
    'PRIMARY',
    'UNIQUE',
    'id',
    'created_at',
    'updated_at'
  ];
  columnNames = columnNames.filter(name => !excludedColumns.includes(name));

  return columnNames;
}

async function storeEvents(startBlock, endBlock, provider, contractAddr) {

  const networkId = (await provider.getNetwork()).chainId;
  const contract = await ethers.getContractAt("ICCIPMockup", contractAddr);

  const filter_CCIPSendRequested = contract.filters.CCIPSendRequested();
  filter_CCIPSendRequested.fromBlock = startBlock;
  filter_CCIPSendRequested.toBlock = endBlock;

  const filter_Transmitted = contract.filters.Transmitted();
  filter_Transmitted.fromBlock = startBlock;
  filter_Transmitted.toBlock = endBlock;

  const transactionDatas_CCIPSendRequested = await provider.getLogs(filter_CCIPSendRequested);
  const transactionDatas_Transmitted = await provider.getLogs(filter_Transmitted);

  for (let i = 0; i < transactionDatas_CCIPSendRequested.length; i++) {
    const data_CCIPSendRequested = transactionDatas_CCIPSendRequested[i];

    const blockNumber = data_CCIPSendRequested.blockNumber;
    const blockTimstamp = (await provider.getBlock(blockNumber)).timestamp;
    const messageId = data_CCIPSendRequested.topics[1];
    const chainId = Number(data_CCIPSendRequested.topics[2]);
    const transactionHash = data_CCIPSendRequested.transactionHash;

    const params = [blockNumber, blockTimstamp, messageId, networkId, transactionHash];
    const tableColumns = extractColumnNames(dbConfig.schema.fromTxConfig.tableSchema);
    await insertData(dbConfig.schema.fromTxConfig.tableName, tableColumns, params);
  }

  for (let i = 0; i < transactionDatas_Transmitted.length; i++) {
    const data_Transmitted = transactionDatas_Transmitted[i];

    const blockNumber = data_Transmitted.blockNumber;
    const blockTimstamp = (await provider.getBlock(blockNumber)).timestamp;
    const messageId = data_Transmitted.topics[1];
    const transactionHash = data_Transmitted.transactionHash;

    const params = [blockNumber, blockTimstamp, messageId, networkId, transactionHash];
    const tableColumns = extractColumnNames(dbConfig.schema.toTxConfig.tableSchema);
    await insertData(dbConfig.schema.toTxConfig.tableName, tableColumns, params);
  }
}

// Function to perform initial synchronization
async function sync() {

  await attach();

  const startBlock = await getLastBlock();
  const currentBlock = await provider.getBlockNumber();

  console.log(`startBlock: ${startBlock}, currentBlock: ${currentBlock}`);

  for (let i = startBlock; i <= currentBlock; i += 100000) {
    const endBlock = Math.min(i + 100000 - 1, currentBlock);
    console.log(`Fetching PairCreated events from block ${i} to ${endBlock}`);

    await storeEvents(startBlock, endBlock, provider, contractAddr);

    await sleep(1000);
  }

  await updateLastBlock(currentBlock);

  console.log('Initial sync completed');
  startCronJob(provider, contractAddr);
}

// Function to continue synchronization every 10 seconds
function startCronJob(provider, contractAddr) {

  console.log('Job started');

  setInterval(async () => {

    const lastBlock = await getLastBlock();
    const currentBlock = await provider.getBlockNumber();

    console.log(`lastBlock: ${lastBlock}, currentBlock: ${currentBlock}`);

    // Fetch new PairCreated events
    await storeEvents(lastBlock + 1, currentBlock, provider, contractAddr);

    // Update the last block processed
    await updateLastBlock(currentBlock);
  }, 10000);
}

module.exports = sync;
