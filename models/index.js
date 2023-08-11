require('dotenv').config();

const lastBlocks = require("./schemas/lastBlocks");
const toTx = require("./schemas/toTx");
const fromTx = require("./schemas/fromTx");

// config
const config = {
    host: process.env.HOST,
    user: process.env.DB_USER,
    password: process.env.PASSWORD,
    port: process.env.PORT,
};

// schema
const fromTxConfig = {
    tableName: 'fromTx',
    tableSchema: fromTx,
};

const toTxConfig = {
    tableName: 'toTx',
    tableSchema: toTx,
};

const lastBlocksConfig = {
    tableName: 'lastBlocks',
    tableSchema: lastBlocks,
};

// db name
const dbName = "explorer";

const dbConfig = {
    config,
    dbName,
    schema: {
        lastBlocksConfig,
        fromTxConfig,
        toTxConfig,
    },
};

module.exports = dbConfig;