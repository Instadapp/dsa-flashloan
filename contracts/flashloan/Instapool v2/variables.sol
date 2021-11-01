pragma solidity ^0.7.0;

contract Variables {

    // Whitelisted Sigs;
    mapping (bytes4 => bool) public whitelistedSigs;

    bool internal initializeCheck;

    address internal _owner;
}