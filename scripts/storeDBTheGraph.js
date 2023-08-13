const {
    ethers
} = require('hardhat');
const mysql = require('mysql2/promise');

const dbConfig = require('../models/index');

const CcipTheGraphSynchronizer = require("./ccip/CcipTheGraphSynchronizer");
const HyperlaneTheGraphSynchronizer = require("./hyperlane/HyperlaneTheGraphSynchronizer");

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

async function store() {
    const connection = await initialize();

    const infos = [
        ["https://api.studio.thegraph.com/query/51055/l2vop/v0.0.1", "https://optimism-goerli.publicnode.com", 420],
        ["https://api.studio.thegraph.com/query/51055/l2vbase/v0.0.1", "https://1rpc.io/base-goerli", 84531],
    ]

    const storeHyperlane = async (qu, url, ni) => {
        const provider = new ethers.providers.JsonRpcProvider(url);

        const synchronizer = new HyperlaneTheGraphSynchronizer(connection, provider, qu, ni);
        synchronizer.sync();
    }

    const storeCcip = async (qu, url, ni) => {
        const provider = new ethers.providers.JsonRpcProvider(url);

        const synchronizer = new CcipTheGraphSynchronizer(connection, provider, qu, ni);
        synchronizer.sync();
    }

    for (let i = 0; i < infos.length; i++) {
        storeHyperlane(infos[i][0], infos[i][1], infos[i][2]);
        storeCcip(infos[i][0], infos[i][1], infos[i][2]);
    }
}

module.exports = store;