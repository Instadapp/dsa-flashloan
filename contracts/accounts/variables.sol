pragma solidity ^0.7.0;

contract Variables {
    // Auth Module(Address of Auth => bool).
    mapping(address => bool) internal _auth;
    uint256 internal _status = 1;
}
