pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { DSMath } from "../libs/math.sol";

interface Account {
    struct Info {
        address owner; // The address that owns the account
        uint256 number; // A nonce that allows a single address to control many accounts
    }
}

interface ListInterface {
    function accountID(address) external view returns (uint64);
}

interface Actions {
    enum ActionType {
        Deposit, // supply tokens
        Withdraw, // borrow tokens
        Transfer, // transfer balance between accounts
        Buy, // buy an amount of some token (publicly)
        Sell, // sell an amount of some token (publicly)
        Trade, // trade tokens against another account
        Liquidate, // liquidate an undercollateralized or expiring account
        Vaporize, // use excess tokens to zero-out a completely negative account
        Call // send arbitrary data to an address
    }

    struct ActionArgs {
        ActionType actionType;
        uint256 accountId;
        Types.AssetAmount amount;
        uint256 primaryMarketId;
        uint256 secondaryMarketId;
        address otherAddress;
        uint256 otherAccountId;
        bytes data;
    }

    struct DepositArgs {
        Types.AssetAmount amount;
        Account.Info account;
        uint256 market;
        address from;
    }

    struct WithdrawArgs {
        Types.AssetAmount amount;
        Account.Info account;
        uint256 market;
        address to;
    }

    struct CallArgs {
        Account.Info account;
        address callee;
        bytes data;
    }
}

interface Types {
    enum AssetDenomination {
        Wei, // the amount is denominated in wei
        Par // the amount is denominated in par
    }

    enum AssetReference {
        Delta, // the amount is given as a delta from the current value
        Target // the amount is given as an exact number to end up at
    }

    struct AssetAmount {
        bool sign; // true if positive
        AssetDenomination denomination;
        AssetReference ref;
        uint256 value;
    }

    struct Wei {
        bool sign; // true if positive
        uint256 value;
    }
}


interface ISoloMargin {
    struct OperatorArg {
        address operator;
        bool trusted;
    }

    function getMarketTokenAddress(uint256 marketId)
        external
        view
        returns (address);

    function getNumMarkets() external view returns (uint256);


    function operate(
        Account.Info[] calldata accounts,
        Actions.ActionArgs[] calldata actions
    ) external;

    function getAccountWei(Account.Info calldata account, uint256 marketId)
        external
        view
        returns (Types.Wei memory);
}

contract DydxFlashloanBase {
    function _getMarketIdFromTokenAddress(address _solo, address token)
        internal
        view
        returns (uint256)
    {
        ISoloMargin solo = ISoloMargin(_solo);

        uint256 numMarkets = solo.getNumMarkets();

        address curToken;
        for (uint256 i = 0; i < numMarkets; i++) {
            curToken = solo.getMarketTokenAddress(i);

            if (curToken == token) {
                return i;
            }
        }

        revert("No marketId found for provided token");
    }

    function _getAccountInfo() internal view returns (Account.Info memory) {
        return Account.Info({owner: address(this), number: 1});
    }

    function _getWithdrawAction(uint marketId, uint256 amount)
        internal
        view
        returns (Actions.ActionArgs memory)
    {
        return
            Actions.ActionArgs({
                actionType: Actions.ActionType.Withdraw,
                accountId: 0,
                amount: Types.AssetAmount({
                    sign: false,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: amount
                }),
                primaryMarketId: marketId,
                secondaryMarketId: 0,
                otherAddress: address(this),
                otherAccountId: 0,
                data: ""
            });
    }

    function _getCallAction(bytes memory data)
        internal
        view
        returns (Actions.ActionArgs memory)
    {
        return
            Actions.ActionArgs({
                actionType: Actions.ActionType.Call,
                accountId: 0,
                amount: Types.AssetAmount({
                    sign: false,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: 0
                }),
                primaryMarketId: 0,
                secondaryMarketId: 0,
                otherAddress: address(this),
                otherAccountId: 0,
                data: data
            });
    }

    function _getDepositAction(uint marketId, uint256 amount)
        internal
        view
        returns (Actions.ActionArgs memory)
    {
        return
            Actions.ActionArgs({
                actionType: Actions.ActionType.Deposit,
                accountId: 0,
                amount: Types.AssetAmount({
                    sign: true,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: amount
                }),
                primaryMarketId: marketId,
                secondaryMarketId: 0,
                otherAddress: address(this),
                otherAccountId: 0,
                data: ""
            });
    }
}

/**
 * @title ICallee
 * @author dYdX
 *
 * Interface that Callees for Solo must implement in order to ingest data.
 */
interface ICallee {

    // ============ Public Functions ============

    /**
     * Allows users to send this contract arbitrary data.
     *
     * @param  sender       The msg.sender to Solo
     * @param  accountInfo  The account from which the data is being sent
     * @param  data         Arbitrary data given by the sender
     */
    function callFunction(
        address sender,
        Account.Info calldata accountInfo,
        bytes calldata data
    )
        external;
}

interface DSAInterface {
    function cast(address[] calldata _targets, bytes[] calldata _datas, address _origin) external payable;
}

interface IndexInterface {
  function master() external view returns (address);
}

interface TokenInterface {
    function approve(address, uint256) external;
    function transfer(address, uint) external;
    function transferFrom(address, address, uint) external;
    function deposit() external payable;
    function withdraw(uint) external;
    function balanceOf(address) external view returns (uint);
    function decimals() external view returns (uint);
}

contract Setup {
    IndexInterface public constant instaIndex = IndexInterface(0x2971AdFa57b20E5a416aE5a708A8655A9c74f723);
    ListInterface public constant instaList = ListInterface(0x4c8a1BEb8a87765788946D6B19C6C6355194AbEb);

    address public constant soloAddr = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;
    address public constant wethAddr = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant ethAddr = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    TokenInterface wethContract = TokenInterface(wethAddr);
    ISoloMargin solo = ISoloMargin(soloAddr);

    address public makerConnect = address(0x33c4f6d6c0A123AF5F1655EA5Fd730098d0aBD50);
    address public compoundConnect = address(0x33d4876A16F712f1a305C5594A5AdeDc9b7A9f14);
    address public aaveConnect = address(0x01d0734e34B0251f46aD34d1a82c4946a5B943D9);

    uint public vaultId;
    uint public fee; // Fee in percent

    modifier isMaster() {
        require(msg.sender == instaIndex.master(), "not-master");
        _;
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
        uint route;
        address[] tokens;
        uint[] amounts;
        address[] dsaTargets;
        bytes[] dsaData;
    }

}

contract Helper is Setup {
    event LogChangedFee(uint newFee);

    function encodeDsaCastData(
        address dsa,
        uint route,
        address[] memory tokens,
        uint[] memory amounts,
        bytes memory data
    ) internal pure returns (bytes memory _data) {
        CastData memory cd;
        (cd.dsaTargets, cd.dsaData) = abi.decode(
            data,
            (address[], bytes[])
        );
        _data = abi.encode(dsa, route, tokens, amounts, cd.dsaTargets, cd.dsaData);
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

    function updateFee(uint _fee) public isMaster {
        require(_fee != fee, "same-fee");
        require(_fee < 10 ** 15, "more-than-max-fee"); 
        fee = _fee;
        emit LogChangedFee(_fee);
    }

    function masterSpell(address _target, bytes calldata _data) external isMaster {
        spell(_target, _data);
    }
}

contract Resolver is Helper {

    function selectBorrow(address[] memory tokens, uint[] memory amts, uint route) internal {
        if (route == 0) {
            return;
        } else if (route == 1) {
            bytes memory _dataOne = abi.encodeWithSignature("deposit(uint256,uint256)", vaultId, uint(-1));
            bytes memory _dataTwo = abi.encodeWithSignature("borrow(uint256,uint256)", vaultId, amts[0]);
            spell(makerConnect, _dataOne);
            spell(makerConnect, _dataTwo);
        } else if (route == 2) {
            bytes memory _dataOne = abi.encodeWithSignature("deposit(address,uint256)", ethAddr, uint(-1));
            spell(compoundConnect, _dataOne);
            for (uint i = 0; i < amts.length; i++) {
                bytes memory _dataTwo = abi.encodeWithSignature("borrow(address,uint256)", tokens[i], amts[i]);
                spell(compoundConnect, _dataTwo);
            }
        } else if (route == 3) {
            bytes memory _dataOne = abi.encodeWithSignature("deposit(address,uint256)", ethAddr, uint(-1));
            spell(aaveConnect, _dataOne);
            for (uint i = 0; i < amts.length; i++) {
                bytes memory _dataTwo = abi.encodeWithSignature("borrow(address,uint256)", tokens[i], amts[i]);
                spell(aaveConnect, _dataTwo);
            }
        } else {
            revert("route-not-found");
        }
    }

    function selectPayback(address[] memory tokens, uint route) internal {
        if (route == 0) {
            return;
        } else if (route == 1) {
            bytes memory _dataOne = abi.encodeWithSignature("payback(uint256,uint256)", vaultId, uint(-1));
            bytes memory _dataTwo = abi.encodeWithSignature("withdraw(uint256,uint256)", vaultId, uint(-1));
            spell(makerConnect, _dataOne);
            spell(makerConnect, _dataTwo);
        } else if (route == 2) {
            for (uint i = 0; i < tokens.length; i++) {
                bytes memory _data = abi.encodeWithSignature("payback(address,uint256)", tokens[i], uint(-1));
                spell(compoundConnect, _data);
            }
            bytes memory _dataOne = abi.encodeWithSignature("withdraw(address,uint256)", ethAddr, uint(-1));
            spell(compoundConnect, _dataOne);
        } else if (route == 3) {
            for (uint i = 0; i < tokens.length; i++) {
                bytes memory _data = abi.encodeWithSignature("payback(address,uint256)", tokens[i], uint(-1));
                spell(aaveConnect, _data);
            }
            bytes memory _dataOne = abi.encodeWithSignature("withdraw(address,uint256)", ethAddr, uint(-1));
            spell(aaveConnect, _dataOne);
        } else {
            revert("route-not-found");
        }
    }

}

contract DydxFlashloaner is Resolver, ICallee, DydxFlashloanBase, DSMath {
    using SafeERC20 for IERC20;

    struct FlashLoanData {
        uint[] _iniBals;
        uint[] _finBals;
        uint[] _feeAmts;
        uint[] _tokenDecimals;
    }

    event LogFlashLoan(
        address indexed sender,
        address[] tokens,
        uint[] amounts,
        uint[] feeAmts,
        uint route
    );

    function checkWeth(address[] memory tokens, uint _route) internal pure returns (bool) {
        if (_route == 0) {
            for (uint i = 0; i < tokens.length; i++) {
                if (tokens[i] == ethAddr) {
                    return true;
                }
            }
        } else {
            return true;
        }
        return false;
    }

    function convertTo18(uint256 _amt, uint _dec) internal pure returns (uint256 amt) {
        amt = mul(_amt, 10 ** (18 - _dec));
    }


    function callFunction(
        address sender,
        Account.Info memory account,
        bytes memory data
    ) public override {
        require(sender == address(this), "not-same-sender");
        require(msg.sender == soloAddr, "not-solo-dydx-sender");
        CastData memory cd;
        (cd.dsa, cd.route, cd.tokens, cd.amounts, cd.dsaTargets, cd.dsaData) = abi.decode(
            data,
            (address, uint256, address[], uint256[], address[], bytes[])
        );

        bool isWeth = checkWeth(cd.tokens, cd.route);
        if (isWeth) {
            wethContract.withdraw(wethContract.balanceOf(address(this)));
        }

        selectBorrow(cd.tokens, cd.amounts, cd.route);

        uint _length = cd.tokens.length;

        for (uint i = 0; i < _length; i++) {
            if (cd.tokens[i] == ethAddr) {
                payable(cd.dsa).transfer(cd.amounts[i]);
            } else {
                IERC20(cd.tokens[i]).safeTransfer(cd.dsa, cd.amounts[i]);
            }
        }

        DSAInterface(cd.dsa).cast(cd.dsaTargets, cd.dsaData, 0xB7fA44c2E964B6EB24893f7082Ecc08c8d0c0F87);

        selectPayback(cd.tokens, cd.route);

        if (isWeth) {
            wethContract.deposit{value: address(this).balance}();
        }
    }

    function routeDydx(address[] memory _tokens, uint256[] memory _amounts, uint _route, bytes memory data) internal {
        uint _length = _tokens.length;
        IERC20[] memory _tokenContracts = new IERC20[](_length);
        uint[] memory _marketIds = new uint[](_length);

        for (uint i = 0; i < _length; i++) {
            address _token =  _tokens[i] == ethAddr ? wethAddr : _tokens[i];
            _marketIds[i] = _getMarketIdFromTokenAddress(soloAddr, _token);
            _tokenContracts[i] = IERC20(_token);
            _tokenContracts[i].approve(soloAddr, _amounts[i] + 2); // TODO - give infinity allowance??
        }

        uint _opLength = _length * 2 + 1;
        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](_opLength);

        for (uint i = 0; i < _length; i++) {
            operations[i] = _getWithdrawAction(_marketIds[i], _amounts[i]);
        }
        operations[_length] = _getCallAction(encodeDsaCastData(msg.sender, _route, _tokens, _amounts, data));
        for (uint i = 0; i < _length; i++) {
            uint _opIndex = _length + 1 + i;
            operations[_opIndex] = _getDepositAction(_marketIds[i], _amounts[i] + 2);
        }

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();

        FlashLoanData memory flashloanData;

        flashloanData._iniBals = new uint[](_length);
        flashloanData._finBals = new uint[](_length);
        flashloanData._feeAmts = new uint[](_length);
        flashloanData._tokenDecimals = new uint[](_length);
        for (uint i = 0; i < _length; i++) {
            uint tokenBal = _tokenContracts[i].balanceOf(address(this));
            if (_tokens[i] == ethAddr) {
                flashloanData._iniBals[i] = add(tokenBal, address(this).balance);
            } else {
                flashloanData._iniBals[i] = tokenBal;
            }
            flashloanData._tokenDecimals[i] = TokenInterface(address(_tokenContracts[i])).decimals();
        }

        solo.operate(accountInfos, operations);

        for (uint i = 0; i < _length; i++) {
            flashloanData._finBals[i] = _tokenContracts[i].balanceOf(address(this));
            if (fee == 0) {
                flashloanData._feeAmts[i] = 0;
                uint _dif = wmul(convertTo18(_amounts[i], flashloanData._tokenDecimals[i]), 200000000000); // Taking margin of 0.0000002%
                require(convertTo18(sub(flashloanData._iniBals[i], flashloanData._finBals[i]), flashloanData._tokenDecimals[i]) <= _dif, "amount-paid-less");
            } else {
                uint _feeLowerLimit = wmul(_amounts[i], wmul(fee, 999500000000000000)); // removing 0.05% fee for decimal/dust error
                uint _feeUpperLimit = wmul(_amounts[i], wmul(fee, 1000500000000000000)); // adding 0.05% fee for decimal/dust error
                require(flashloanData._finBals[i] >= flashloanData._iniBals[i], "final-balance-less-than-inital-balance");
                flashloanData._feeAmts[i] = sub(flashloanData._finBals[i], flashloanData._iniBals[i]);
                require(_feeLowerLimit < flashloanData._feeAmts[i] && flashloanData._feeAmts[i] < _feeUpperLimit, "amount-paid-less");
            }
        }

        emit LogFlashLoan(
            msg.sender,
            _tokens,
            _amounts,
            flashloanData._feeAmts,
            _route
        );

    }

    function routeProtocols(address[] memory _tokens, uint256[] memory _amounts, uint _route, bytes memory data) internal {
        uint _length = _tokens.length;
        uint256 wethMarketId = 0;

        uint _amount = wethContract.balanceOf(soloAddr); // CHECK9898 - does solo has all the ETH?
        _amount = wmul(_amount, 999000000000000000); // 99.9% weth borrow
        wethContract.approve(soloAddr, _amount + 2);

        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

        operations[0] = _getWithdrawAction(wethMarketId, _amount);
        operations[1] = _getCallAction(encodeDsaCastData(msg.sender, _route, _tokens, _amounts, data));
        operations[2] = _getDepositAction(wethMarketId, _amount + 2);

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();
        
        FlashLoanData memory flashloanData;

        flashloanData._iniBals = new uint[](_length);
        flashloanData._finBals = new uint[](_length);
        flashloanData._feeAmts = new uint[](_length);
        flashloanData._tokenDecimals = new uint[](_length);
        IERC20[] memory _tokenContracts = new IERC20[](_length);
        for (uint i = 0; i < _length; i++) {
            address _token =  _tokens[i] == ethAddr ? wethAddr : _tokens[i];
            _tokenContracts[i] = IERC20(_token);
            uint tokenBal = _tokenContracts[i].balanceOf(address(this));
            if (_tokens[i] == ethAddr) {
                flashloanData._iniBals[i] = add(tokenBal, address(this).balance);
            } else {
                flashloanData._iniBals[i] = tokenBal;
            }
            flashloanData._tokenDecimals[i] = TokenInterface(_token).decimals();
        }

        solo.operate(accountInfos, operations);

        for (uint i = 0; i < _length; i++) {
            flashloanData._finBals[i] = _tokenContracts[i].balanceOf(address(this));
            if (fee == 0) {
                flashloanData._feeAmts[i] = 0;
                uint _dif = wmul(convertTo18(_amounts[i], flashloanData._tokenDecimals[i]), 200000000000); // Taking margin of 0.0000002%
                require(convertTo18(sub(flashloanData._iniBals[i], flashloanData._finBals[i]), flashloanData._tokenDecimals[i]) <= _dif, "amount-paid-less");
            } else {
                uint _feeLowerLimit = wmul(_amounts[i], wmul(fee, 999500000000000000)); // removing 0.05% fee for decimal/dust error
                uint _feeUpperLimit = wmul(_amounts[i], wmul(fee, 1000500000000000000)); // adding 0.05% fee for decimal/dust error
                require(flashloanData._finBals[i] >= flashloanData._iniBals[i], "final-balance-less-than-inital-balance");
                flashloanData._feeAmts[i] = sub(flashloanData._finBals[i], flashloanData._iniBals[i]);
                require(_feeLowerLimit < flashloanData._feeAmts[i] && flashloanData._feeAmts[i] < _feeUpperLimit, "amount-paid-less");
            }
        }

        emit LogFlashLoan(
            msg.sender,
            _tokens,
            _amounts,
            flashloanData._feeAmts,
            _route
        );

    }

    function initiateFlashLoan(	
        address[] calldata _tokens,	
        uint256[] calldata _amounts,	
        uint _route,	
        bytes calldata data	
    ) external isDSA {	
        if (_route == 0) {	
            routeDydx(_tokens, _amounts, _route, data);	
        } else {	
            routeProtocols(_tokens, _amounts, _route, data);	
        }	
    }
}

contract InstaPool is DydxFlashloaner {
    constructor(
        uint _vaultId
    ) public {
        wethContract.approve(wethAddr, uint(-1));
        vaultId = _vaultId;
        fee =  0;
    }

    receive() external payable {}
}