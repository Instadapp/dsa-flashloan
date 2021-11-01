pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import { Helper } from "./helpers.sol";

import { 
    IndexInterface,
    ListInterface,
    TokenInterface,
    DSAInterface,
    IAaveLending
} from "./interfaces.sol";


contract AaveFlashloaner is Helper {
    using SafeERC20 for IERC20;

    constructor(
        address instaIndex_,
        address wchainToken_,
        address aaveLendingAddr_
    ) Helper(instaIndex_, wchainToken_, aaveLendingAddr_) {}


    event LogFlashLoan(
        address indexed dsa,
        address[] tokens,
        uint256[] amounts
    );

    event LogWhitelistSig(bytes4 indexed sig, bool whitelist);

    /**
    * @dev Check if sig is whitelisted
    * @param _sig bytes4
    */
    function checkWhitelisted(bytes4 _sig) public view returns(bool) {
        return whitelistedSigs[_sig];
    }

    function calFee(uint[] memory amts_) external view returns (uint[] memory finalAmts_, uint[] memory premiums_, uint fee_) {
        fee_ = aaveLending.FLASHLOAN_PREMIUM_TOTAL();
        for (uint i = 0; i < amts_.length; i++) {
            premiums_[i] = (amts_[i] * fee_) / 10000;
            finalAmts_[i] = finalAmts_[i] + premiums_[i];
        }
    }

    /**
    * @dev Whitelists / Blacklists a given sig
    * @param _sigs list of sigs
    * @param _whitelist list of bools indicate whitelist/blacklist
    */
    function whitelistSigs(bytes4[] memory _sigs, bool[] memory _whitelist) public onlyOwner {
        require(_sigs.length == _whitelist.length, "arr-lengths-unequal");
        for (uint i = 0; i < _sigs.length; i++) {
            require(!whitelistedSigs[_sigs[i]], "already-enabled");
            whitelistedSigs[_sigs[i]] = _whitelist[i];
            emit LogWhitelistSig(_sigs[i], _whitelist[i]);
        }
    }

    struct ExecuteOperationVariables {
        uint256 _length;
        IERC20[] _tokenContracts;
        bool[] isWChainToken;
    }
    
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata _data
    ) external returns (bool) {
        require(initiator == address(this), "not-same-sender");
        require(msg.sender == aaveLendingAddr, "not-aave-sender");

        ExecuteOperationVariables memory e;

        e._length = assets.length;
        e._tokenContracts = new IERC20[](e._length);
        e.isWChainToken = new bool[](e._length);

        CastData memory cd;
        (cd.dsa, cd.callData) = abi.decode(
            _data,
            (address, bytes)
        );

        for (uint i = 0; i < e._length; i++) {
            e._tokenContracts[i] = IERC20(assets[i]);
            e._tokenContracts[i].approve(aaveLendingAddr, amounts[i] + premiums[i]);
            e.isWChainToken[i] = assets[i] == chainToken || assets[i] == wchainToken;
            if (e.isWChainToken[i]) {
                wchainContract.withdraw(wchainContract.balanceOf(address(this)));
            }
            if (assets[i] == wchainToken) {
                Address.sendValue(payable(cd.dsa), amounts[i]);
            } else {
                e._tokenContracts[i].safeTransfer(cd.dsa, amounts[i]);
            }
        }

        Address.functionCall(cd.dsa, cd.callData, "DSA-flashloan-fallback-failed");

        for (uint i = 0; i < e._length; i++) {
            if (e.isWChainToken[i]) {
                wchainContract.deposit{value: address(this).balance}();
            }
        }
        return true;
    }

    function routeAave(address[] memory _tokens, uint256[] memory _amounts, bytes memory data) internal {
        uint[] memory _modes = new uint[](1);

        _modes[0] = 0;
        
        data = abi.encode(msg.sender, data);

        uint _length = _tokens.length;
        uint[] memory iniBals = new uint[](_length);
        uint[] memory finBals = new uint[](_length);
        IERC20[] memory _tokenContracts = new IERC20[](_length);
        for (uint i = 0; i < _length; i++) {
            require(_tokens[i] != wchainToken, "borrow-wchain-token-not-allowed");
            address _token = _tokens[i] == chainToken ? wchainToken : _tokens[i];
            _tokens[i] = _token;
            _tokenContracts[i] = IERC20(_tokens[i]);
            if (_token == wchainToken) {
                iniBals[i] = add(_tokenContracts[i].balanceOf(address(this)), address(this).balance);
            } else {
                iniBals[i] = _tokenContracts[i].balanceOf(address(this));
            }
        }

        aaveLending.flashLoan(address(this), _tokens, _amounts, _modes, address(0), data, 3228);

        for (uint i = _length; i < _length; i++) {
            address _token = _tokens[i] == chainToken ? wchainToken : _tokens[i];
            if (_token == wchainToken) {
                finBals[i] = add(_tokenContracts[i].balanceOf(address(this)), address(this).balance);
            } else {
                finBals[i] = _tokenContracts[i].balanceOf(address(this));
            }
            require(iniBals[i] <= finBals[i], "amount-paid-less");
        }

        emit LogFlashLoan(
            msg.sender,
            _tokens,
            _amounts
        );
    }

    function initiateFlashLoan(	
        address token,	
        uint256 amount,
        uint256,
        bytes calldata data	
    ) external isDSA isWhitelisted(data) {
        address[] memory tokens_ = new address[](1);
        uint[] memory amounts_ = new uint[](1);
        tokens_[0] = token;
        amounts_[0] = amount;
        routeAave(tokens_, amounts_, data);	
    }

    function initiateMultiFlashLoan(	
        address[] memory tokens_,	
        uint256[] memory amounts_,
        uint256,
        bytes calldata data	
    ) external isDSA isWhitelisted(data) {	
        routeAave(tokens_, amounts_, data);	
    }
}

contract InstaPoolV2ImplementationV2 is AaveFlashloaner {

    constructor(
        address instaIndex_,
        address wchainToken_,
        address aaveLendingAddr_
    ) AaveFlashloaner(instaIndex_, wchainToken_, aaveLendingAddr_) {
        
    }

    function initialize(
        bytes4[] memory sigs,
        address owner
    ) intialized() public {
        for (uint i = 0; i < sigs.length; i++) {
            whitelistedSigs[sigs[i]] = true;
        }
        wchainContract.approve(wchainToken, uint256(-1));
        _owner = owner;
        emit OwnershipTransferred(address(0), owner);
    }

    receive() external payable {}

}