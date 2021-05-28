pragma solidity ^0.7.0;

contract Variables {
    // Maker connector
    address public makerConnect;

    // AaveV2 connector
    address public aaveV2Connect;

    // Maker ETH-A Vault ID
    uint256 public vaultId;

    // Whitelisted Sigs;
    mapping (bytes4 => bool) public whitelistedSigs;
}