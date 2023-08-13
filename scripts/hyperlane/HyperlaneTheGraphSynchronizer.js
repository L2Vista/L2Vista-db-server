const axios = require("axios");
const dbConfig = require('../../models/index');

class TheGraphSynchronizer {
    constructor(co, pro, qu, ni) {
        this.provider = pro;
        this.queryURL = qu;
        this.networkId = ni;
        this.connection = co;
        this.CATEGORY = "hyperlane";
        this.FIRST_NUMBER = 100;
        this.SKIP_NUMBER = 0;
        this.CRON_SLEEP_TIME = 1000;
    }

    async dispatchesQuery(_first, _skip) {
        const dispatchesQuery =
            `query {
                dispatches(first: ${_first}, skip: ${_skip}, orderByField: "blockTimestamp", orderByDirection: "DESC") {
                id
                sender
                destination
                recipient
                blockNumber
                blockTimestamp
                transactionHash
                }
                dispatchIds(first: ${_first}, skip: ${_skip},  orderByField: "blockTimestamp", orderByDirection: "DESC") {
                id
                messageId
                blockNumber
                blockTimestamp
                }
            }
            `;

        const response = await axios.post(this.queryURL, {
            query: dispatchesQuery
        });

        return response.data.data;
    }

    async processIdQuery(_first, _skip) {
        const processIdsQuery =
            `query {
                        processIds(first: ${_first}, skip: ${_skip}, orderByField: "blockTimestamp", orderByDirection: "DESC") {
                        messageId
                        blockNumber
                        blockTimestamp
                        transactionHash
                    }
                }
            `;

        const response = await axios.post(this.queryURL, {
            query: processIdsQuery
        });

        return response.data.data;
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

    async store() {
        const sendDatas = await this.dispatchesQuery(this.FIRST_NUMBER, this.SKIP_NUMBER);
        for (let i = 0; i < sendDatas.dispatches.length; i++) {
            const blockNumber = sendDatas.dispatches[i].blockNumber;
            const blockTimstamp = sendDatas.dispatches[i].blockTimestamp;
            const messageId = sendDatas.dispatchIds[i].messageId;
            const transactionHash = sendDatas.dispatches[i].transactionHash;
            const { from, to } = await this.getFromToAddress(transactionHash);

            const params = [blockNumber, blockTimstamp, messageId, from, to, this.CATEGORY, this.networkId, transactionHash];
            const tableColumns = this.extractColumnNames(dbConfig.schema.fromTxConfig.tableSchema);
            await this.insertData(dbConfig.schema.fromTxConfig.tableName, tableColumns, params);
        }

        const receiveDatas = await this.processIdQuery(this.FIRST_NUMBER, this.SKIP_NUMBER);
        for (let i = 0; i < receiveDatas.processIds.length; i++) {
            const blockNumber = receiveDatas.processIds[i].blockNumber;
            const blockTimstamp = receiveDatas.processIds[i].blockTimestamp;
            const messageId = receiveDatas.processIds[i].messageId;
            const transactionHash = receiveDatas.processIds[i].transactionHash;
            const { from, to } = await this.getFromToAddress(transactionHash);

            const params = [blockNumber, blockTimstamp, messageId, from, to, this.CATEGORY, this.networkId, transactionHash];
            const tableColumns = this.extractColumnNames(dbConfig.schema.toTxConfig.tableSchema);
            await this.insertData(dbConfig.schema.toTxConfig.tableName, tableColumns, params);
        }
    }

    sync() {
        console.log(`${this.CATEGORY} Job started.`);

        setInterval(async () => {
            await this.store();
        }, this.CRON_SLEEP_TIME);
    }
}

module.exports = TheGraphSynchronizer;
