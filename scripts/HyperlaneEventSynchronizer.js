const dbConfig = require('../models/index');

class EventSynchronizer {
    constructor(con, cg, tn, pro, ca) {
        this.connection = con;
        this.category = cg;
        this.tableName = tn;
        this.provider = pro;
        this.contract = ca;
        this.BLOCK_INTERVAL = 1000;
        this.SYNC_SLEEP_TIME = 1000;
        this.CRON_SLEEP_TIME = 10000;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getLastBlock() {
        try {
            const [rows, fields] = await this.connection.execute(`SELECT MAX(blockNumber) as lastBlock FROM lastBlocks WHERE tableName = "${this.tableName}"`);
            return rows[0].lastBlock || 0;
        } catch (err) {
            console.error('Error: ', err);
        }
    }

    async updateLastBlock(endBlock) {
        try {
            const [rows] = await this.connection.execute(
                'SELECT * FROM lastBlocks WHERE tableName = ?',
                [this.tableName]
            );

            if (rows.length > 0) {
                await this.connection.execute(
                    'UPDATE lastBlocks SET blockNumber = ? WHERE tableName = ?',
                    [endBlock, this.tableName]
                );
            } else {
                await this.connection.execute(
                    'INSERT INTO lastBlocks (tableName, blockNumber) VALUES (?, ?)',
                    [this.tableName, endBlock]
                );
            }
        } catch (err) {
            console.error('Error: ', err);
        }
    }

    async insertData(tableName, columns, params) {
        const columnNames = columns.join(', ');
        const placeholders = new Array(columns.length).fill('?').join(', ');

        const sql = `
        INSERT IGNORE INTO ${tableName} (${columnNames}) 
        VALUES (${placeholders})`;

        try {
            const [rows, fields] = await this.connection.execute(sql, params);
            console.log(`Inserted ${rows.affectedRows} row(s).`);
        } catch (err) {
            console.error('Error: ', err);
        }
    }

    extractColumnNames(schemaString) {
        const regex = /\s(\w+)\s.+/g;
        let match;
        let columnNames = [];

        while ((match = regex.exec(schemaString)) !== null) {
            columnNames.push(match[1]);
        }

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

    async storeEvents(startBlock, endBlock) {
        const networkId = (await this.provider.getNetwork()).chainId;

        const filter_Dispatch = this.contract.filters.Dispatch();
        filter_Dispatch.fromBlock = startBlock;
        filter_Dispatch.toBlock = endBlock;

        const filter_DispatchId = this.contract.filters.DispatchId();
        filter_DispatchId.fromBlock = startBlock;
        filter_DispatchId.toBlock = endBlock;

        const filter_ProcessId = this.contract.filters.ProcessId();
        filter_ProcessId.fromBlock = startBlock;
        filter_ProcessId.toBlock = endBlock;

        const transactionDatas_Dispatch = await this.provider.getLogs(filter_Dispatch);
        const transactionDatas_DispatchId = await this.provider.getLogs(filter_DispatchId);
        const transactionDatas_ProcessId = await this.provider.getLogs(filter_ProcessId);

        for (let i = 0; i < transactionDatas_Dispatch.length; i++) {
            const data_Dispatch = transactionDatas_Dispatch[i];
            const data_DispatchId = transactionDatas_DispatchId[i];

            const blockNumber = data_Dispatch.blockNumber;
            const blockTimstamp = (await this.provider.getBlock(blockNumber)).timestamp;
            const messageId = data_DispatchId.topics[1];
            const transactionHash = data_Dispatch.transactionHash;

            const params = [blockNumber, blockTimstamp, messageId, this.category, networkId, transactionHash];
            const tableColumns = this.extractColumnNames(dbConfig.schema.fromTxConfig.tableSchema);
            await this.insertData(dbConfig.schema.fromTxConfig.tableName, tableColumns, params);
        }

        for (let i = 0; i < transactionDatas_ProcessId.length; i++) {
            const data_ProcessId = transactionDatas_ProcessId[i];

            const blockNumber = data_ProcessId.blockNumber;
            const blockTimstamp = (await this.provider.getBlock(blockNumber)).timestamp;
            const messageId = data_ProcessId.topics[1];
            const transactionHash = data_ProcessId.transactionHash;

            const params = [blockNumber, blockTimstamp, messageId, this.category, networkId, transactionHash];
            const tableColumns = this.extractColumnNames(dbConfig.schema.toTxConfig.tableSchema);
            await this.insertData(dbConfig.schema.toTxConfig.tableName, tableColumns, params);
        }
    }

    startCronJob() {
        console.log(`${this.tableName} Job started.`);

        setInterval(async () => {
            const lastBlock = await this.getLastBlock();
            const currentBlock = await this.provider.getBlockNumber();
            await this.storeEvents(lastBlock + 1, currentBlock);
            await this.updateLastBlock(currentBlock);
        }, this.CRON_SLEEP_TIME);
    }

    async sync() {
        const startBlock = await this.getLastBlock();
        const currentBlock = await this.provider.getBlockNumber();

        console.log(`tableName: ${this.tableName}, startBlock: ${startBlock}, currentBlock: ${currentBlock}`);

        for (let i = startBlock; i <= currentBlock; i += this.BLOCK_INTERVAL) {
            const endBlock = Math.min(i + this.BLOCK_INTERVAL - 1, currentBlock);
            await this.storeEvents(i, endBlock);
            await this.sleep(this.SYNC_SLEEP_TIME);
        }

        await this.updateLastBlock(currentBlock);

        console.log('Initial sync completed');
        this.startCronJob();
    }
}

module.exports = EventSynchronizer;
