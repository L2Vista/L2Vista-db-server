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

    const contractAddr = "0xCC737a94FecaeC165AbCf12dED095BB13F037685";

    const infos = [
        ["alfajores", "https://alfajores-forno.celo-testnet.org", contractAddr, 18706336], // 15339044
        ["fuji", "https://api.avax-test.network/ext/bc/C/rpc", contractAddr, 23964427], // 17333916
        ["mumbai", "https://endpoints.omniatech.io/v1/matic/mumbai/public", contractAddr, 37843923], // 30170960
        ["binance", "https://binance-testnet.rpc.thirdweb.com", contractAddr, 31304453], // 25793854
        ["goerli", "https://ethereum-goerli.publicnode.com", contractAddr, 9309795], // 8204033
        ["optimism", "https://optimism-goerli.publicnode.com", contractAddr, 11942654], // 3746084
        ["arbitrum", "https://arbitrum-goerli.publicnode.com", contractAddr, 30182841], // 3563223
        ["sepolia", "https://eth-sepolia.g.alchemy.com/v2/demo", contractAddr, 3879748], // 3082935
        ["moonbase", "https://moonbeam-alpha.api.onfinality.io/public", contractAddr, 4707950], // 3429551
    ]

    const storeHyperlaneV2 = async (cn, url, ca, bn) => {
        const category = `hyperlane`;
        const tableName = `${cn}_hyperlane_v2`;
        const provider = new ethers.providers.JsonRpcProvider(url);
        const contract = await ethers.getContractAt("IHyperlaneMockup", ca);

        const synchronizer = new HyperlaneEventSynchronizer(connection, category, tableName, provider, contract, bn);
        synchronizer.sync();
    }

    for (let i = 0; i < infos.length; i++) {
        storeHyperlaneV2(infos[i][0], infos[i][1], infos[i][2], infos[i][3]);
    }
}

main();