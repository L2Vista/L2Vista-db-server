const {
    ethers
} = require('hardhat');
const mysql = require('mysql2/promise');

const chainInfo = require("../config/chainInfo");
const dbConfig = require('../models/index');

const CcipEventSynchronizer = require("./CcipEventSynchronizer");
const HyperlaneEventSynchronizer = require("./HyperlaneEventSynchronizer");

async function initialize() {
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

    return connection;
}

async function main() {
    const connection = await initialize();

    const storeCcip = async (chainName) => {
        const category = `ccip`;
        const tableName = `${chainName}_ccip`;
        const provider = new ethers.providers.JsonRpcProvider(chainInfo[chainName].url);
        const contract = await ethers.getContractAt("ICCIPMockup", chainInfo[chainName].ccipAddr);

        const synchronizer = new CcipEventSynchronizer(connection, category, tableName, provider, contract);
        synchronizer.sync();
    }

    const storeHyperlane = async (chainName) => {
        const category = `hyperlane`;
        const tableName = `${chainName}_hyperlane`;
        const provider = new ethers.providers.JsonRpcProvider(chainInfo[chainName].url);
        const contract = await ethers.getContractAt("IHyperlaneMockup", chainInfo[chainName].hyperlaneAddr);

        const synchronizer = new HyperlaneEventSynchronizer(connection, category, tableName, provider, contract);
        synchronizer.sync();
    }

    const l2Arr = Object.keys(chainInfo);
    for (let i = 0; i < l2Arr.length; i++) {
        console.log(`Store ${l2Arr[i]} Hyperlane Contract data.`);
        storeCcip(l2Arr[i]);
        storeHyperlane(l2Arr[i]);
    }
}

main();