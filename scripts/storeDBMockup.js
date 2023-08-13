const {
    ethers
} = require('hardhat');
const mysql = require('mysql2/promise');

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

    const hyperlaneInfos = [
        ["mode", "https://sepolia.mode.network", "0xF647E71bb4704De8E413166ebcA875c4ea0f2480", 2030852], // 15339044
        ["optimism", "https://optimism-goerli.publicnode.com", "0xD693d08BE428127d2Ef6496c01cc606E44B28fe3", 13250790], // 3746084
        ["zora", "https://testnet.rpc.zora.co", "0xD76169e3592C48d21879f537791Ea585E21585ab", 869873], // 3563223
        ["base", "https://1rpc.io/base-goerli", "0x5418ed830A6756031F6CF96fA302D5a95D1dBbcb", 8368007], // 3429551
    ]

    const storeHyperlaneV2 = async (cn, url, ca, bn) => {
        const category = `hyperlane`;
        const tableName = `${cn}_hyperlane`;
        const provider = new ethers.providers.JsonRpcProvider(url);
        const contract = await ethers.getContractAt("IHyperlaneMockup", ca);

        const synchronizer = new HyperlaneEventSynchronizer(connection, category, tableName, provider, contract, bn);
        synchronizer.sync();
    }

    for (let i = 0; i < hyperlaneInfos.length; i++) {
        storeHyperlaneV2(hyperlaneInfos[i][0], hyperlaneInfos[i][1], hyperlaneInfos[i][2], hyperlaneInfos[i][3]);
    }

    const ccipInfos = [
        [
            "mode",
            "https://sepolia.mode.network",
            "0xb6c87a438b1FE7EE0D30048559F84b078FFc08E9",
            "0xb6c87a438b1FE7EE0D30048559F84b078FFc08E9",
            2030852
        ], // 3082935
        [
            "optimism",
            "https://optimism-goerli.publicnode.com",
            "0x2857E9799E4B7d3ad9ecC3e00c4599fdCa9756Ad",
            "0x2857E9799E4B7d3ad9ecC3e00c4599fdCa9756Ad",
            13250790
        ], // 3746084
        [
            "zora",
            "https://testnet.rpc.zora.co",
            "0x2857E9799E4B7d3ad9ecC3e00c4599fdCa9756Ad",
            "0x2857E9799E4B7d3ad9ecC3e00c4599fdCa9756Ad",
            869873
        ], // 3563223
        [
            "base", 
            "https://1rpc.io/base-goerli", 
            "0xBb7027d4Bd8B022F653541E8a38D6094611376A3", 
            "0xBb7027d4Bd8B022F653541E8a38D6094611376A3", 
            8368007
        ], // 30170960
    ]

    const storeCcipV2 = async (cn, url, onCa, offCa, bn) => {
        const category = `ccip`;
        const tableName = `${cn}_ccip`;
        const provider = new ethers.providers.JsonRpcProvider(url);
        const onContract = await ethers.getContractAt("ICCIPMockup", onCa);
        const offContract = await ethers.getContractAt("ICCIPMockup", offCa);

        const synchronizer = new CcipEventSynchronizer(connection, category, tableName, provider, onContract, offContract, bn);
        synchronizer.sync();
    }

    for (let i = 0; i < ccipInfos.length; i++) {
        storeCcipV2(ccipInfos[i][0], ccipInfos[i][1], ccipInfos[i][2], ccipInfos[i][3], ccipInfos[i][4]);
    }
}

main();