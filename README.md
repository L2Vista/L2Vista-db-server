# L2Vista-db-server Project
This project showcases the functionality of the L2Vista-db-server. It is designed to store events originating from the CCIP and Hyperlane contracts on various Ethereum layer2 chains, including mode, zora, optimism, and base.

## Features
- Database Initialization: Automatic creation of the 'exployer' database.
- Table Structures: Automated generation of 'fromTx', 'toTx', and 'lastBlocks' tables.
- Mode & Zora Event Storage: Retrieval and storage of past events from mode and zora chains.
- thegraph Integration: Utilization of thegraph for event storage on optimism and base chains.

## Database Schema
### `fromTx` & `toTx` Table Structure:
```sql
blockNumber INT,
blockTimestamp INT,
messageId VARCHAR(255) NOT NULL UNIQUE,
chain VARCHAR(255) NOT NULL,
hash VARCHAR(255) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

### `lastBlocks` Table Structure:
```sql
blockNumber INT,
tableName VARCHAR(255) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

## Set Up Configuration:
1. **Review the `.example.env` file.**
2. **Create a `.env` file based on the example.** Adjust the values as 

For Linux or macOS:
```shell
cp .example.env .env
```
For Windows:
```shell
copy .example.env .env
```

## Quick Start Guide
1. **Install Dependencies:**
```shell
npm install
```

2. **Compile Contracts:**
```shell
npx hardhat compile
```

3. **Launch the Project:**
```shell
npm start
```

## Contributing
If you'd like to contribute to the project, please fork the repository, make your changes, and submit a pull request. We appreciate all contributions and feedback!