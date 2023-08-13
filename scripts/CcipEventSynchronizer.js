const dbConfig = require('../models/index');

class EventSynchronizer {
    constructor(con, cg, tn, pro, onCa, offCa, bn) {
        this.connection = con;
        this.category = cg;
        this.tableName = tn;
        this.provider = pro;
        this.onContract = onCa;
        this.offContract = offCa;
        this.START_BLOCK_NUMBER = bn;
        this.BLOCK_INTERVAL = 1000;
        this.SYNC_SLEEP_TIME = 100;
        this.CRON_SLEEP_TIME = 30000;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getLastBlock() {
        try {
            const [rows, fields] = await this.connection.execute(`SELECT MAX(blockNumber) as lastBlock FROM lastBlocks WHERE tableName = "${this.tableName}"`);
            return rows[0].lastBlock || this.START_BLOCK_NUMBER;
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

    async getFromToAddress(transactionHash) {
        try {
            const transactionData = await this.provider.getTransaction(transactionHash);
            const from = transactionData.from;
            const to = transactionData.to;
            
            return { from, to };
        } catch (error) {
            const from = "0x0000000000000000000000000000000000000000";
            const to = "0x0000000000000000000000000000000000000000";
            
            return { from, to };
        }
    }

    async storeEvents(startBlock, endBlock) {
        const networkId = (await this.provider.getNetwork()).chainId;

        const filter_CCIPSendRequested = this.onContract.filters.CCIPSendRequested();
        filter_CCIPSendRequested.fromBlock = startBlock;
        filter_CCIPSendRequested.toBlock = endBlock;

        const filter_ExecutionStateChanged = this.offContract.filters.ExecutionStateChanged();
        filter_ExecutionStateChanged.fromBlock = startBlock;
        filter_ExecutionStateChanged.toBlock = endBlock;

        const transactionDatas_CCIPSendRequested = await this.provider.getLogs(filter_CCIPSendRequested);
        const transactionDatas_ExecutionStateChanged = await this.provider.getLogs(filter_ExecutionStateChanged);

        for (let i = 0; i < transactionDatas_CCIPSendRequested.length; i++) {
            const data_CCIPSendRequested = transactionDatas_CCIPSendRequested[i];
            const { messageId } = this.onContract.interface.parseLog(data_CCIPSendRequested).args[0];
            
            const blockNumber = data_CCIPSendRequested.blockNumber;
            const blockTimstamp = (await this.provider.getBlock(blockNumber)).timestamp;
            const transactionHash = data_CCIPSendRequested.transactionHash;
            const { from, to } = await this.getFromToAddress(transactionHash);

            const params = [blockNumber, blockTimstamp, messageId, from, to, this.category, networkId, transactionHash];
            const tableColumns = this.extractColumnNames(dbConfig.schema.fromTxConfig.tableSchema);
            await this.insertData(dbConfig.schema.fromTxConfig.tableName, tableColumns, params);
        }

        for (let i = 0; i < transactionDatas_ExecutionStateChanged.length; i++) {
            const data_ExecutionStateChanged = transactionDatas_ExecutionStateChanged[i];

            const blockNumber = data_ExecutionStateChanged.blockNumber;
            const blockTimstamp = (await this.provider.getBlock(blockNumber)).timestamp;
            const messageId = data_ExecutionStateChanged.topics[2];
            const transactionHash = data_ExecutionStateChanged.transactionHash;
            const { from, to } = await this.getFromToAddress(transactionHash);

            const params = [blockNumber, blockTimstamp, messageId, from, to, this.category, networkId, transactionHash];
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

            await this.updateLastBlock(endBlock);
        }

        console.log('Initial sync completed');
        this.startCronJob();
    }
}

module.exports = EventSynchronizer;
