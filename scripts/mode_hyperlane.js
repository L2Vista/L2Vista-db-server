const {
  ethers
} = require('hardhat');
const mysql = require('mysql2/promise');

const chainInfo = require("../config/chainInfo");
const dbConfig = require('../models/index');

const tableName = "mode_hyperlane";

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
  contractAddr = chainInfo.mode.hyperlaneAddr;
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
  const contract = await ethers.getContractAt("IHyperlaneMockup", contractAddr);

  const filter_Dispatch = contract.filters.Dispatch();
  filter_Dispatch.fromBlock = startBlock;
  filter_Dispatch.toBlock = endBlock;

  const filter_DispatchId = contract.filters.DispatchId();
  filter_DispatchId.fromBlock = startBlock;
  filter_DispatchId.toBlock = endBlock;

  const filter_ProcessId = contract.filters.ProcessId();
  filter_ProcessId.fromBlock = startBlock;
  filter_ProcessId.toBlock = endBlock;

  const transactionDatas_Dispatch = await provider.getLogs(filter_Dispatch);
  const transactionDatas_DispatchId = await provider.getLogs(filter_DispatchId);
  const transactionDatas_ProcessId = await provider.getLogs(filter_ProcessId);

  for (let i = 0; i < transactionDatas_Dispatch.length; i++) {
    const data_Dispatch = transactionDatas_Dispatch[i];
    const data_DispatchId = transactionDatas_DispatchId[i];

    const blockNumber = data_Dispatch.blockNumber;
    const blockTimstamp = (await provider.getBlock(blockNumber)).timestamp;
    const messageId = data_DispatchId.topics[1];
    const transactionHash = data_Dispatch.transactionHash;

    const params = [blockNumber, blockTimstamp, messageId, networkId, transactionHash];
    const tableColumns = extractColumnNames(dbConfig.schema.fromTxConfig.tableSchema);
    await insertData(dbConfig.schema.fromTxConfig.tableName, tableColumns, params);
  }

  for (let i = 0; i < transactionDatas_ProcessId.length; i++) {
    const data_ProcessId = transactionDatas_ProcessId[i];

    const blockNumber = data_ProcessId.blockNumber;
    const blockTimstamp = (await provider.getBlock(blockNumber)).timestamp;
    const messageId = data_ProcessId.topics[1];
    const transactionHash = data_ProcessId.transactionHash;

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
