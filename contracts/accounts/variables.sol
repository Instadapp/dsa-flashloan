pragma solidity ^0.7.0;

contract Variables {
    // Auth Module(Address of Auth => bool).
    mapping(address => bool) internal _auth;
    // Reentrancy Guard variable
    uint256 internal _status;
}
