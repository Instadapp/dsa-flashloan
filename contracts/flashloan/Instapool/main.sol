pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { Helper } from "./helpers.sol";

import { 
    IndexInterface,
    ListInterface,
    TokenInterface,
    Account,
    Actions,
    Types,
    ISoloMargin,
    ICallee,
    DSAInterface
} from "./interfaces.sol";

import { DydxFlashloanBase } from "./dydxBase.sol";

contract DydxFlashloaner is Helper, ICallee, DydxFlashloanBase {
    using SafeERC20 for IERC20;

    mapping (bytes4 => bool) whitelistedSigs;

    event LogFlashLoan(
        address indexed dsa,
        address token,
        uint256 amount,
        uint route
    );


    /**
    * @dev Converts the encoded data to sig.
    * @param _data encoded data
    */
    function convertDataToSig(bytes memory _data) public pure returns(bytes4 sig) {
        assembly {
            sig := mload(add(_data, 4))
        } 
    }

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

    function whitelistSigs(bytes4[] memory _sigs, bool[] memory _whitelist) public {
        require(_sigs.length == _whitelist.length, "arr-lengths-unequal");
        for (uint i = 0; i < _sigs.length; i++) {
            whitelistedSigs[_sigs[i]] = _whitelist[i];
        }
    }

    /**
    * @dev modifier to check if data's sig is whitelisted
    */
    modifier isWhitelisted(bytes memory _data) {
        require(checkWhitelisted(convertDataToSig(_data)), "sig-not-whitelisted");
        _;
    }
    
    function callFunction(
        address sender,
        Account.Info memory account,
        bytes memory data
    ) public override {
        require(sender == address(this), "not-same-sender");
        require(msg.sender == soloAddr, "not-solo-dydx-sender");
        CastData memory cd;
        (cd.dsa, cd.sender, cd.route, cd.token, cd.amount, cd.dsaTargets, cd.dsaData) = abi.decode(
            data,
            (address, address, uint256, address, uint256, string[], bytes[])
        );

        bool isWeth = cd.route == 1 || cd.token == ethAddr; // TODO
        if (isWeth) {
            wethContract.withdraw(wethContract.balanceOf(address(this)));
        }

        selectBorrow(cd.route, cd.amount);

        if (cd.token == ethAddr) {
            payable(cd.dsa).transfer(cd.amount);
        } else {
            IERC20(cd.token).safeTransfer(cd.dsa, cd.amount);
        }

        DSAInterface(cd.dsa).flashCallback(cd.sender, cd.token, cd.amount, cd.dsaTargets, cd.dsaData, address(this));

        selectPayback(cd.route);

        if (isWeth) {
            wethContract.deposit{value: address(this).balance}();
        }
    }

    function routeDydx(address token, uint256 amount, bytes memory data) internal {
        uint256 _amount = amount;

        uint256 route = 0;
        address _token;
        if (token == daiAddr) {
            uint256 dydxDaiAmt = daiContract.balanceOf(soloAddr);
            if (amount > dydxDaiAmt) {
                uint256 dydxWEthAmt = wethContract.balanceOf(soloAddr);
                route = 1;
                _amount = dydxWEthAmt;
                _token = wethAddr;
            } else {
                _token = token;
            }
        } else {
            _token = token == ethAddr ? wethAddr : token;
        }
        
        IERC20 _tokenContract = IERC20(_token);
        uint256 _marketId = _getMarketIdFromTokenAddress(soloAddr, _token);

        _tokenContract.approve(soloAddr, _amount + 2); // TODO - give infinity allowance??

        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

        operations[0] = _getWithdrawAction(_marketId, _amount);
        operations[1] = _getCallAction(encodeDsaCastData(msg.sender, route, token, amount, data));
        operations[2] = _getDepositAction(_marketId, _amount + 2);

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();

        uint256 initailBal = add(_tokenContract.balanceOf(address(this)), address(this).balance);

        solo.operate(accountInfos, operations);

        uint256 finalBal = add(_tokenContract.balanceOf(address(this)), address(this).balance);

        if (_token == wethAddr) {
            uint256 _dif = wmul(_amount, 10000000000); // Taking margin of 0.00000001%
            require(sub(initailBal, finalBal) <= _dif, "eth-amount-paid-less");
        } else {
            uint256 _decimals = TokenInterface(token).decimals();
            uint _dif = wmul(convertTo18(_amount, _decimals), 10000000000); // Taking margin of 0.00000001%
            require(convertTo18(sub(initailBal, finalBal), _decimals) <= _dif, "token-amount-paid-less");
        }
            
        emit LogFlashLoan(
            msg.sender,
            token,
            amount,
            route
        );

    }

    function initiateFlashLoan(	
        address token,	
        uint256 amount,	
        bytes calldata data	
    ) external isDSA {	
        routeDydx(token, amount, data);	
    }
}

contract InstaPoolV2 is DydxFlashloaner {
    constructor(
        uint256 _vaultId,
        address _makerConnect
    ) public {
        wethContract.approve(wethAddr, uint(-1));
        vaultId = _vaultId;
        makerConnect = _makerConnect;
    }

    receive() external payable {}
}