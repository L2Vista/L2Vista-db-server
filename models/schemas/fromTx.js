module.exports = `
    blockNumber INT,
    blockTimestamp INT,
    messageId VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(255) NOT NULL,
    chain VARCHAR(255) NOT NULL,
    hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
`;