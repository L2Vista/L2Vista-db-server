const {
    ethers
} = require('hardhat');
const axios = require("axios");
const mysql = require('mysql2/promise');

const chainInfo = require("../config/chainInfo");
const dbConfig = require('../models/index');

const firstNumber = 10;
const skipNumber = 0;
const networkId = chainInfo.optimism.chainId;
const queryURL = "https://api.studio.thegraph.com/query/51055/l2vistaoptimsmgoerli/v0.0.1";

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
}

async function ccipsendRequestedsQuery(_first, _skip) {
    
    //define the query to fetch a list of ten tokens 
    const ccipsendRequestedsQuery =
        `query {
      ccipsendRequesteds(first: ${_first}, skip: ${_skip}, orderByField: "blockTimestamp", orderByDirection: "DESC") {
          id
          sourceChainSelector
          sequenceNumber
          feeTokenAmount
          blockNumber
          blockTimestamp
          transactionHash
        }
      }
    `;

    const response = await axios.post(queryURL, {
        query: ccipsendRequestedsQuery
    });

    const queryResult = response.data.data;

    return queryResult;
}

async function transmittedsQuery(_first, _skip) {
    
    //define the query to fetch a list of ten tokens 
    const transmittedsQuery =
        `query {
          transmitteds(first: ${_first}, skip: ${_skip}, orderByField: "blockTimestamp", orderByDirection: "DESC") {
            id
            configDigest
            epoch
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

    const response = await axios.post(queryURL, {
        query: transmittedsQuery
    });

    const queryResult = response.data.data;

    return queryResult;
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

async function store() {
    await attach();

    const sendDatas = await ccipsendRequestedsQuery(firstNumber, skipNumber);
    for (let i = 0; i < sendDatas.ccipsendRequesteds.length; i++) {
        const blockNumber = sendDatas.ccipsendRequesteds[i].blockNumber;
        const blockTimstamp = sendDatas.ccipsendRequesteds[i].blockTimestamp;
        const messageId = sendDatas.ccipsendRequesteds[i].sourceChainSelector;
        const transactionHash = sendDatas.ccipsendRequesteds[i].transactionHash;

        const params = [blockNumber, blockTimstamp, messageId, networkId, transactionHash];
        const tableColumns = extractColumnNames(dbConfig.schema.fromTxConfig.tableSchema);
        await insertData(dbConfig.schema.fromTxConfig.tableName, tableColumns, params);
    }

    const receiveDatas = await transmittedsQuery(firstNumber, skipNumber);
    for (let i = 0; i < receiveDatas.transmitteds.length; i++) {
        const blockNumber = receiveDatas.transmitteds[i].blockNumber;
        const blockTimstamp = receiveDatas.transmitteds[i].blockTimestamp;
        const messageId = receiveDatas.transmitteds[i].configDigest;
        const transactionHash = receiveDatas.transmitteds[i].transactionHash;

        const params = [blockNumber, blockTimstamp, messageId, networkId, transactionHash];
        const tableColumns = extractColumnNames(dbConfig.schema.toTxConfig.tableSchema);
        await insertData(dbConfig.schema.toTxConfig.tableName, tableColumns, params);
    }
}

module.exports = store;