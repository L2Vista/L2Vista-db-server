// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Internal} from "./libraries/Internal.sol";

interface ICCIPMockup {
    event CCIPSendRequested(Internal.EVM2EVMMessage message);

    event ExecutionStateChanged(
        uint64 indexed sequenceNumber,
        bytes32 indexed messageId,
        Internal.MessageExecutionState state,
        bytes returnData
    );
}
