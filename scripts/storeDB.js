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
        ["alfajores", "https://alfajores-forno.celo-testnet.org", contractAddr, 19176411], // 15339044
        ["fuji", "https://avalanche-fuji-c-chain.publicnode.com", contractAddr, 24764520], // 17333916
        ["mumbai", "https://rpc-mumbai.maticvigil.com", contractAddr, 38680753], // 30170960
        ["binance", "https://binance-testnet.rpc.thirdweb.com", contractAddr, 32194202], // 25793854
        ["goerli", "https://ethereum-goerli.publicnode.com", contractAddr, 9468703], // 8204033
        ["optimism", "https://optimism-goerli.publicnode.com", contractAddr, 12941617], // 3746084
        ["arbitrum", "https://arbitrum-goerli.publicnode.com", contractAddr, 33100158], // 3563223
        ["sepolia", "https://eth-sepolia.g.alchemy.com/v2/demo", contractAddr, 4033835], // 3082935
        ["moonbase", "https://moonbeam-alpha.api.onfinality.io/public", contractAddr, 4861269], // 3429551
    ]

    const storeHyperlaneV2 = async (cn, url, ca, bn) => {
        const category = `hyperlane`;
        const tableName = `${cn}_hyperlane_v2`;
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
            "sepolia",
            "https://eth-sepolia.g.alchemy.com/v2/demo",
            "0xE42Ecce39ce5Bd2bbf2443660Ba6979EeafD48dF",
            "0x1F06781450e994b0005Ce2922FCa78E2c72D4353",
            4033835
        ], // 3082935
        [
            "optimism",
            "https://optimism-goerli.publicnode.com",
            "0x6Bb8d729C35F29dF532EB3998DdAcE336187C84B",
            "0xdc4606e96c37b877f2c9ddda82104c85a198a82d",
            12941617
        ], // 3746084
        [
            "fuji",
            "https://avalanche-fuji-c-chain.publicnode.com",
            "0xA799c1855875e79b2e1752412058B485ee51AEc4",
            "0x61c67e7b7c90ed1a44dabb26c33900270df7a144",
            24764520
        ], // 17333916
        [
            "arbitrum",
            "https://arbitrum-goerli.publicnode.com",
            "0x782a7Ba95215f2F7c3dD4C153cbB2Ae3Ec2d3215",
            "0xff4b0c64c50d2d7b444cb28699df03ed4bbaf44f",
            33100158
        ], // 3563223
        [
            "mumbai", 
            "https://rpc-mumbai.maticvigil.com", 
            "0xA83f2CeCB391779B59022eDeD6EbBA0d7eC01F20", 
            "0xbe582db704bd387222c70ca2e5a027e5e2c06fb7", 
            38680753
        ], // 30170960
    ]

    const storeCcipV2 = async (cn, url, onCa, offCa, bn) => {
        const category = `ccip`;
        const tableName = `${cn}_ccip_v2`;
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