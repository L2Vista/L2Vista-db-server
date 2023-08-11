// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// import "hardhat/console.sol";

interface IHyperlaneMockup {
    event Dispatch(
        address indexed sender,
        uint32 indexed destination,
        bytes32 indexed recipient,
        bytes message
    );

    event DispatchId(bytes32 indexed messageId);

    event ProcessId(bytes32 indexed messageId);

    function sendMessage(
        uint32 _destinationDomain,
        bytes calldata _messageBody
    ) external;

    function receiveMessage(bytes32 _id) external;
}