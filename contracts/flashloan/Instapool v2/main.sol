pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import { Helper } from "./helpers.sol";

import { 
    IndexInterface,
    ListInterface,
    TokenInterface,
    DSAInterface
} from "./interfaces.sol";

interface IAaveLending {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// interface IFlashLoanReceiver {
//   function executeOperation(
//     address[] calldata assets,
//     uint256[] calldata amounts,
//     uint256[] calldata premiums,
//     address initiator,
//     bytes calldata params
//   ) external returns (bool);

//   function ADDRESSES_PROVIDER() external view returns (ILendingPoolAddressesProvider);

//   function LENDING_POOL() external view returns (ILendingPool);
// }

contract AaveFlashloaner is Helper {
    using SafeERC20 for IERC20;

    constructor(
        address instaIndex_,
        address wchainToken_,
        address aaveLendingAddr_
    ) Helper(instaIndex_, wchainToken_, aaveLendingAddr_) {}


    event LogFlashLoan(
        address indexed dsa,
        address token,
        uint256 amount,
        uint route
    );

    event LogWhitelistSig(bytes4 indexed sig, bool whitelist);

    /**
    * @dev Check if sig is whitelisted
    * @param _sig bytes4
    */
    function checkWhitelisted(bytes4 _sig) public view returns(bool) {
        return whitelistedSigs[_sig];
    }
    

    /**
    * @dev Whitelists / Blacklists a given sig
    * @param _sigs list of sigs
    * @param _whitelist list of bools indicate whitelist/blacklist
    */
    function whitelistSigs(bytes4[] memory _sigs, bool[] memory _whitelist) public isMaster {
        require(_sigs.length == _whitelist.length, "arr-lengths-unequal");
        for (uint i = 0; i < _sigs.length; i++) {
            require(!whitelistedSigs[_sigs[i]], "already-enabled");
            whitelistedSigs[_sigs[i]] = _whitelist[i];
            emit LogWhitelistSig(_sigs[i], _whitelist[i]);
        }
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

        uint _length = assets.length;
        IERC20[] memory _tokenContracts = new IERC20[](_length);
        bool[] memory isWChainToken = new bool[](_length);

        CastData memory cd;
        (cd.dsa, cd.callData) = abi.decode(
            _data,
            (address, bytes)
        );

        for (uint i = 0; i < _length; i++) {
            _tokenContracts[i] = IERC20(assets[i]);
            _tokenContracts[i].approve(aaveLendingAddr, amounts[i] + premiums[i]);
            isWChainToken[i] = assets[i] == chainToken;
            if (isWChainToken[i]) {
                wchainContract.withdraw(wchainContract.balanceOf(address(this)));
            }
            if (assets[i] == wchainToken) {
                payable(cd.dsa).transfer(amounts[i]);
            } else {
                _tokenContracts[i].safeTransfer(cd.dsa, amounts[i]);
            }
        }

        Address.functionCall(cd.dsa, cd.callData, "DSA-flashloan-fallback-failed");

        for (uint i = 0; i < _length; i++) {
            if (isWChainToken[i]) {
                wchainContract.deposit{value: address(this).balance}();
            }
        }
    }

    function routeAave(address[] memory _tokens, uint256[] memory _amounts, bytes memory data) internal {
        uint[] memory _modes = new uint[](1);

        _modes[0] = 0;
        
        data = abi.encode(msg.sender, data);

        uint _length = _tokens.length;
        uint[] memory iniBals = new uint[](_length);
        uint[] memory finBals = new uint[](_length);
        IERC20[] memory _tokenContracts = new IERC20[](_length);
        for (uint i = _length; i < _length; i++) {
            _tokenContracts[i] = IERC20(_tokens[i]);
            address _token = _tokens[i] == chainToken ? wchainToken : _tokens[i];
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

        // TODO: Add event
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

contract InstaPoolV2Implementation is AaveFlashloaner {

    constructor(
        address instaIndex_,
        address wchainToken_,
        address aaveLendingAddr_
    ) AaveFlashloaner(instaIndex_, wchainToken_, aaveLendingAddr_) {}

    modifier intialized() {
        require(!initializeCheck, "already-initialized");
        _;
        initializeCheck = true;
    }

    function initialize() intialized() public {
        wchainContract.approve(wchainToken, uint256(-1));
    }

    receive() external payable {}
}