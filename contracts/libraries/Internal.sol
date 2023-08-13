// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Client} from "./Client.sol";

// Library for CCIP internal definitions common to multiple contracts.
library Internal {
    // @notice The cross chain message that gets committed to EVM chains
    struct EVM2EVMMessage {
        uint64 sourceChainSelector;
        uint64 sequenceNumber;
        uint256 feeTokenAmount;
        address sender;
        uint64 nonce;
        uint256 gasLimit;
        bool strict;
        // User fields
        address receiver;
        bytes data;
        Client.EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes32 messageId;
    }

    enum MessageExecutionState {
        UNTOUCHED,
        IN_PROGRESS,
        SUCCESS,
        FAILURE
    }
}
