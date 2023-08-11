// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// import "hardhat/console.sol";

interface ICCIPMockup {
    event CCIPSendRequested(
        bytes32 indexed sourceChainSelector,
        uint256 sequenceNumber,
        uint256 feeTokenAmount,
        address sender,
        uint256 nonce,
        uint256 gasLimit,
        uint256 strict,
        address receiver,
        bytes data,
        uint256 tokenAmounts,
        address feeToken,
        uint256 messageId
    );

    event Transmitted(bytes32 indexed configDigest, uint32 epoch);

    function sendMessage(
        uint32 _destinationDomain,
        bytes calldata _messageBody
    ) external;

    function receiveMessage(bytes32 configDigest) external;
}

select
*
from fromtx
left join totx
on fromtx.messageId = totx.messageId