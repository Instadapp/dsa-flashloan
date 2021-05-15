pragma solidity ^0.7.0;

contract Variables {
    // Maker connector
    address public makerConnect;

    // Maker ETH-A Vault ID
    uint256 public vaultId;

    // Whitelisted Sigs;
    mapping (bytes4 => bool) public whitelistedSigs;
}