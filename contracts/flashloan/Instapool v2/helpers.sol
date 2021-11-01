pragma solidity ^0.7.0;

import { 
    IndexInterface,
    ListInterface,
    TokenInterface,
    IAaveLending
} from "./interfaces.sol";

import { DSMath } from "../../common/math.sol";
import {Ownable} from "./ownable.sol";
import {Variables} from "./variables.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract Setup is Variables, Ownable {
    using SafeERC20 for IERC20;

    constructor(
        address instaIndex_,
        address wchainToken_,
        address aaveLendingAddr_
    ) {
        instaIndex = IndexInterface(instaIndex_);
        instaList = ListInterface(IndexInterface(instaIndex_).list());
        wchainToken = wchainToken_;
        wchainContract = TokenInterface(wchainToken_);
        aaveLendingAddr = aaveLendingAddr_;
        aaveLending = IAaveLending(aaveLendingAddr_);
    }

    IndexInterface public immutable instaIndex;
    ListInterface public immutable instaList;

    address public immutable wchainToken;
    address public constant chainToken = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    TokenInterface public immutable wchainContract;

    address public immutable aaveLendingAddr;
    IAaveLending public immutable aaveLending;

    /**
    * @dev Converts the encoded data to sig.
    * @param data encoded data
    */
    function convertDataToSig(bytes memory data) internal pure returns(bytes4 sig) {
        bytes memory _data = data;
        assembly {
            sig := mload(add(_data, 32))
        } 
    }

    /**
    * @dev modifier to check if data's sig is whitelisted
    */
    modifier isWhitelisted(bytes memory _data) {
        require(whitelistedSigs[convertDataToSig(_data)], "sig-not-whitelisted");
        _;
    }

    modifier intialized() {
        require(!initializeCheck, "already-initialized");
        _;
        initializeCheck = true;
    }

    /**
     * FOR SECURITY PURPOSE
     * only Smart DEFI Account can access the liquidity pool contract
     */
    modifier isDSA {
        uint64 id = instaList.accountID(msg.sender);
        require(id != 0, "not-dsa-id");
        _;
    }

    struct CastData {
        address dsa;
        bytes callData;
    }
}

contract Helper is Setup, DSMath {

    constructor(
        address instaIndex_,
        address wchainToken_,
        address aaveLendingAddr_
    ) Setup(instaIndex_, wchainToken_, aaveLendingAddr_) {}

    function convertTo18(uint256 _amt, uint _dec) internal pure returns (uint256 amt) {
        amt = mul(_amt, 10 ** (18 - _dec));
    }

    function spell(address _target, bytes memory _data) internal {
        require(_target != address(0), "target-invalid");
        assembly {
        let succeeded := delegatecall(gas(), _target, add(_data, 0x20), mload(_data), 0, 0)
        switch iszero(succeeded)
            case 1 {
                let size := returndatasize()
                returndatacopy(0x00, 0x00, size)
                revert(0x00, size)
            }
        }
    }

    function masterSpell(address _target, bytes calldata _data) external onlyOwner {
        spell(_target, _data);
    }

}