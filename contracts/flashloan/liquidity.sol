pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { DSMath } from "../libs/math.sol";

import {DydxFlashloanBase} from "./dydx/DydxFlashloanBase.sol";
import {ICallee} from "./dydx/ICallee.sol";

interface DSAInterface {
    function cast(address[] calldata _targets, bytes[] calldata _datas, address _origin) external payable;
}

interface IndexInterface {
  function master() external view returns (address);
}

contract Setup {
    IndexInterface public constant instaIndex = IndexInterface(0x2971AdFa57b20E5a416aE5a708A8655A9c74f723);

    address public constant soloAddr = 0x4EC3570cADaAEE08Ae384779B0f3A45EF85289DE;
    address public constant wethAddr = 0xd0A1E359811322d97991E03f863a0C30C2cF029C;
    address public constant ethAddr = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    IERC20 wethContract = IERC20(wethAddr);

    address public makerConnect = address(0);
    address public compoundConnect = address(0);
    address public aaveConnect = address(0);

    uint public vaultId; // CHECK9898 - open vault from constructor
    uint public fee = 5 * 10 ** 14; // Fee in percent

    modifier isMaster() {
        require(msg.sender == instaIndex.master(), "not-master");
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
            (uint256, address[], bytes[])
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
        fee = _fee; // any more conditions. Max fee limit?
        // TODO - add event
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

    // CHECK9898 - Aave charges 0.000001% something fees. Keep that in mind at time of payback
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

    event LogDydxFlashLoan(
        address indexed sender,
        address indexed token,
        uint amount
    );

    function callFunction(
        address sender,
        Account.Info memory account,
        bytes memory data
    ) public override {
        require(sender == address(this), "not-same-sender");
        CastData memory cd;
        (cd.dsa, cd.route, cd.tokens, cd.amounts, cd.dsaTargets, cd.dsaData) = abi.decode(
            data,
            (address, uint256, address[], uint256[], address[], bytes[])
        );

        wethContract.approve(wethAddr, uint(-1)); // CHECK9898 - give allowance via construtor
        wethContract.withdraw(wethContract.balanceOf(this));

        selectBorrow(cd.tokens, cd.amounts, cd.route);

        uint _length = cd.tokens.length;

        IERC20 tokenContracts = new IERC20(_length);
        for (uint i = 0; i < _length; i++) {
            if (cd.tokens[i] == ethAddr) {
                payable(cd.dsa).transfer(cd.amounts[i]);
            } else {
                tokenContracts[i] = IERC20(cd.tokens[i]);
                tokenContracts[i].safeTransfer(cd.dsa, cd.amounts[i]);
            }
        }

        DSAInterface(cd.dsa).cast(cd.dsaTargets, cd.dsaData, 0xB7fA44c2E964B6EB24893f7082Ecc08c8d0c0F87);

        selectPayback(cd.tokens, cd.route);

        wethContract.deposit.value(address(this).balance)();
    }

    function routeDydx(address[] memory _tokens, uint256[] memory _amounts, uint _route, bytes calldata data) internal {
        uint _length = _tokens.length;
        IERC20[] _tokenContracts = new IERC20(_length);
        uint[] _marketIds = new uint(_length);

        for (uint i = 0; i < _length; i++) {
            _marketIds[i] = _getMarketIdFromTokenAddress(soloAddr, _token);
            _tokenContracts[i] = IERC20(_tokens[i]);
            _tokenContracts[i].approve(soloAddr, _amounts[i] + 2); // TODO - set in constructor?
        }

        uint _opLength = _length * 2 + 1;
        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](_opLength);

        for (uint i = 0; i < _length; i++) {
            operations[i] = _getWithdrawAction(_marketIds[i], _amounts[i]);
        }
        operations[_length] = _getCallAction(encodeDsaCastData(msg.sender, _route, _tokens, _amounts, data));
        for (uint i = _length + 1; i < _opLength; i++) {
            operations[i] = _getDepositAction(marketId, _amounts[i] + 2);
        }

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();

        uint[] iniBals = new uint(_length);
        uint[] finBals = new uint(_length);
        for (uint i = 0; i < _length; i++) {
            iniBals[i] = _tokenContracts[i].balanceOf(address(this));
        }

        solo.operate(accountInfos, operations);

        for (uint i = 0; i < _length; i++) {
            finBals[i] = add(_tokenContracts[i].balanceOf(address(this)), wmul(_amounts[i]), fee);
            require(sub(iniBals[i], finBals[i]) < 5, "amount-paid-less");
        }

    }

    function routeProtocols(address[] memory _tokens, uint256[] memory _amounts, uint _route, bytes calldata data) internal {
        uint _length = _tokens.length;
        uint256 marketId = 0; // CHECK9898 - set static market ID? => Changed to static ID

        IERC20 _tokenContract = IERC20(wethAddr);
        uint _amount = _tokenContract.balanceOf(soloAddr); // CHECK9898 - does solo has all the ETH?
        _amount = wdiv(_amount, 999000000000000000); // 99.9% weth borrow
        _tokenContract.approve(soloAddr, _amount + 2);

        Actions.ActionArgs[] memory operations = new Actions.ActionArgs[](3);

        operations[0] = _getWithdrawAction(marketId, _amount);
        operations[1] = _getCallAction(encodeDsaCastData(msg.sender, _route, _tokens, _amounts, data));
        operations[2] = _getDepositAction(marketId, _amount + 2);

        Account.Info[] memory accountInfos = new Account.Info[](1);
        accountInfos[0] = _getAccountInfo();

        uint[] iniBals = new uint(_length);
        uint[] finBals = new uint(_length);
        IERC20[] _tokenContracts = new IERC20(_length);
        for (uint i = 0; i < _length; i++) {
            _tokenContracts[i] = IERC20(_tokens[i]);
            iniBals[i] = _tokenContracts[i].balanceOf(address(this));
        }

        solo.operate(accountInfos, operations);

        for (uint i = 0; i < _length; i++) {
            finBals[i] = add(_tokenContracts[i].balanceOf(address(this)), wmul(_amounts[i]), fee);
            require(sub(iniBals[i], finBals[i]) < 5, "amount-paid-less");
        }
    }

    function initiateFlashLoan(
        address[] memory _tokens,
        uint256[] memory _amounts,
        uint _route,
        bytes calldata data
    ) external {
        if (route == 0) {
            routeDydx(_tokens, _amounts, _route, data);
        } else {
            routeProtocols(_tokens, _amounts, _route, data);
        }
    }

}

// contract InstaDydxFlashLoan is DydxFlashloaner {

//     receive() external payable {}
// }