// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Client} from "./libraries/Client.sol";
import {Internal} from "./libraries/Internal.sol";

interface ICCIPMockup {
    event CCIPSendRequested(Internal.EVM2EVMMessage message);
}
