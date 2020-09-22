pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface DydxFlashInterface {
    function initiateFlashLoan(address[] memory tokens, uint256[] memory amts, uint route, bytes calldata data) external;
    function fee() external view returns(uint);
}

interface TokenInterface {
    function allowance(address, address) external view returns (uint);
    function balanceOf(address) external view returns (uint);
    function approve(address, uint) external;
    function transfer(address, uint) external returns (bool);
    function transferFrom(address, address, uint) external returns (bool);
}

interface MemoryInterface {
    function getUint(uint _id) external returns (uint _num);
    function setUint(uint _id, uint _val) external;
}

interface AccountInterface {
    function enable(address) external;
    function disable(address) external;
}

interface EventInterface {
    function emitEvent(uint _connectorType, uint _connectorID, bytes32 _eventCode, bytes calldata _eventData) external;
}

contract DSMath {

    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, "math-not-safe");
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x, "math-not-safe");
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, "sub-overflow");
    }

    uint constant WAD = 10 ** 18;

    function wmul(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, y), WAD / 2) / WAD;
    }

    function wdiv(uint x, uint y) internal pure returns (uint z) {
        z = add(mul(x, WAD), y / 2) / y;
    }
}

contract Helpers is DSMath {

    using SafeERC20 for IERC20;

    /**
     * @dev Return ethereum address
     */
    function getAddressETH() internal pure returns (address) {
        return 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // ETH Address
    }

    /**
     * @dev Return Memory Variable Address
     */
    function getMemoryAddr() internal pure returns (address) {
        return 0x8a5419CfC711B2343c17a6ABf4B2bAFaBb06957F; // InstaMemory Address
    }

    /**
     * @dev Return InstaEvent Address.
     */
    function getEventAddr() internal pure returns (address) {
        return 0x2af7ea6Cb911035f3eb1ED895Cb6692C39ecbA97; // InstaEvent Address
    }

    /**
     * @dev Get Uint value from InstaMemory Contract.
    */
    function getUint(uint getId, uint val) internal returns (uint returnVal) {
        returnVal = getId == 0 ? val : MemoryInterface(getMemoryAddr()).getUint(getId);
    }

    /**
     * @dev Set Uint value in InstaMemory Contract.
    */
    function setUint(uint setId, uint val) internal {
        if (setId != 0) MemoryInterface(getMemoryAddr()).setUint(setId, val);
    }

    /**
     * @dev Connector Details.
    */
    function connectorID() public pure returns(uint _type, uint _id) {
        (_type, _id) = (1, 33);
    }

    function _transfer(address payable to, IERC20 token, uint _amt) internal {
        address(token) == getAddressETH() ?
            to.transfer(_amt) :
            token.safeTransfer(to, _amt);
    }

    function _getBalance(IERC20 token) internal view returns (uint256) {
        return address(token) == getAddressETH() ?
            address(this).balance :
            token.balanceOf(address(this));
    }
}


contract DydxFlashHelpers is Helpers {
    /**
     * @dev Return Dydx flashloan address
     */
    function getDydxFlashAddr() internal pure returns (address) {
        return 0x06cB7C24990cBE6b9F99982f975f9147c000fec6;
    }

    function calculateTotalFeeAmt(DydxFlashInterface dydxContract, uint amt) internal view returns (uint totalAmt) {
        uint fee = dydxContract.fee();
        if (fee == 0) {
            totalAmt = amt;
        } else {
            uint feeAmt = wmul(amt, fee);
            totalAmt = add(amt, feeAmt);
        }
    }
}

contract EventHelpers is DydxFlashHelpers {
    event LogDydxFlashBorrow(address indexed token, uint256 tokenAmt);

    event LogDydxFlashPayback(address indexed token, uint256 tokenAmt, uint256 totalAmtFee);

    function emitFlashBorrow(address token, uint256 tokenAmt) internal {
        emit LogDydxFlashBorrow(token, tokenAmt);
        bytes32 _eventCode = keccak256("LogFlashBorrow(address,uint256)");
        bytes memory _eventParam = abi.encode(token, tokenAmt);
        (uint _type, uint _id) = connectorID();
        EventInterface(getEventAddr()).emitEvent(_type, _id, _eventCode, _eventParam);
    }

    function emitFlashPayback(address token, uint256 tokenAmt, uint256 totalFeeAmt) internal {
        emit LogDydxFlashPayback(token, tokenAmt, totalFeeAmt);
        bytes32 _eventCode = keccak256("LogDydxFlashPayback(address,uint256,uint256)");
        bytes memory _eventParam = abi.encode(token, tokenAmt, totalFeeAmt);
        (uint _type, uint _id) = connectorID();
        EventInterface(getEventAddr()).emitEvent(_type, _id, _eventCode, _eventParam);
    }
}

contract LiquidityAccessHelper is EventHelpers {
    /**
     * @dev Add Fee Amount to borrowed flashloan/
     * @param amt Get token amount at this ID from `InstaMemory` Contract.
     * @param getId Get token amount at this ID from `InstaMemory` Contract.
     * @param setId Set token amount at this ID in `InstaMemory` Contract.
    */
    function addFeeAmount(uint amt, uint getId, uint setId) external payable {
        uint _amt = getUint(getId, amt);
        require(_amt != 0, "amt-is-0");
        DydxFlashInterface dydxContract = DydxFlashInterface(getDydxFlashAddr());

        uint totalFee = calculateTotalFeeAmt(dydxContract, _amt);

        setUint(setId, totalFee);
    }

}

contract LiquidityAccess is LiquidityAccessHelper {
    /**
     * @dev Borrow Flashloan and Cast spells.
     * @param token Token Address.
     * @param amt Token Amount.
     * @param data targets & data for cast.
     */
    function flashBorrowAndCast(address token, uint amt, uint route, bytes memory data) public payable {
        AccountInterface(address(this)).enable(getDydxFlashAddr());

        address[] memory tokens = new address[](1);
        uint[] memory amts = new uint[](1);
        tokens[0] = token;
        amts[0] = amt;
        emitFlashBorrow(token, amt);

        DydxFlashInterface(getDydxFlashAddr()).initiateFlashLoan(tokens, amts, route, data);

        AccountInterface(address(this)).disable(getDydxFlashAddr());

    }

    /**
     * @dev Return token to dydx flashloan.
     * @param token token address.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amt token amt.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param getId Get token amount at this ID from `InstaMemory` Contract.
     * @param setId Set token amount at this ID in `InstaMemory` Contract.
    */
    function payback(address token, uint amt, uint getId, uint setId) external payable {
        uint _amt = getUint(getId, amt);
        
        DydxFlashInterface dydxContract = DydxFlashInterface(getDydxFlashAddr());
        IERC20 tokenContract = IERC20(token);

        (uint totalFeeAmt) = calculateTotalFeeAmt(dydxContract, _amt);

        _transfer(payable(address(getDydxFlashAddr())), tokenContract, totalFeeAmt);

        setUint(setId, _amt);

        emitFlashPayback(token, _amt, totalFeeAmt);
    }
}

contract LiquidityAccessMulti is LiquidityAccess {
    /**
     * @dev Borrow Flashloan and Cast spells.
     * @param tokens Array of token Addresses.
     * @param amts Array of token Amounts.
     * @param route Route to borrow.
     * @param data targets & data for cast.
     */
    function flashBorrowAndCast(address[] calldata tokens, uint[] calldata amts, uint route, bytes calldata data) external payable {
        AccountInterface(address(this)).enable(getDydxFlashAddr());

        for (uint i = 0; i < tokens.length; i++) {
            emitFlashBorrow(tokens[i], amts[i]);
        }

        DydxFlashInterface(getDydxFlashAddr()).initiateFlashLoan(tokens, amts, route, data);

        AccountInterface(address(this)).disable(getDydxFlashAddr());

    }

    /**
     * @dev Return Multiple token liquidity from InstaPool.
     * @param tokens Array of token addresses.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amts Array of token amounts.
     * @param getId get token amounts at this IDs from `InstaMemory` Contract.
     * @param setId set token amounts at this IDs in `InstaMemory` Contract.
    */
    function flashMultiPayback(address[] calldata tokens, uint[] calldata amts, uint[] calldata getId, uint[] calldata setId) external payable {
        uint _length = tokens.length;
            DydxFlashInterface dydxContract = DydxFlashInterface(getDydxFlashAddr());

        for (uint i = 0; i < _length; i++) {
            uint _amt = getUint(getId[i], amts[i]);
            IERC20 tokenContract = IERC20(tokens[i]);

            
            (uint totalAmtFee) = calculateTotalFeeAmt(dydxContract, _amt);

            _transfer(payable(address(getDydxFlashAddr())), tokenContract, _amt);

            setUint(setId[i], _amt);

            emitFlashPayback(tokens[i], _amt, totalAmtFee);
        }
    }

}

contract ConnectDydxFlashloan is LiquidityAccessMulti {
    string public name = "dYdX-flashloan-v2.0";
}
