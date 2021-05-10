pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { DSMath } from "../../libs/math.sol";
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

contract DydxFlashloaner is Helper, ICallee, DydxFlashloanBase, DSMath {
    using SafeERC20 for IERC20;

    event LogFlashLoan(
        address indexed dsa,
        address token,
        uint256 amount,
        uint route
    );

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

        uint256 finalBal = _tokenContract.balanceOf(address(this));

        require(finalBal + 2 >= initailBal, "Less balance");

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
        uint _vaultId
    ) public {
        wethContract.approve(wethAddr, uint(-1));
        vaultId = _vaultId;
    }

    receive() external payable {}
}