pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

interface DSAInterface {
    function flashCallback(
        address sender,
        address token,
        uint256 amount,
        string[] calldata _targetNames,
        bytes[] calldata _datas,
        address _origin
    ) external;
}

interface IndexInterface {
    function master() external view returns (address);
    function list() external view returns (address);
}

interface ListInterface {
    function accountID(address) external view returns (uint64);
}

interface TokenInterface {
    function approve(address, uint256) external;

    function transfer(address, uint256) external;

    function transferFrom(
        address,
        address,
        uint256
    ) external;

    function deposit() external payable;

    function withdraw(uint256) external;

    function balanceOf(address) external view returns (uint256);

    function decimals() external view returns (uint256);
}

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

    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint);
}
