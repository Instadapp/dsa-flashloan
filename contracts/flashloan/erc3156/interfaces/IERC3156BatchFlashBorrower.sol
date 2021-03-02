pragma solidity ^0.6.0;

import 'erc3156/contracts/interfaces/IERC3156FlashBorrower.sol';

interface IERC3156BatchFlashBorrower is IERC3156FlashBorrower {
    function onBatchFlashLoan(
        address sender,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata fees,
        bytes calldata data
    ) external returns (bytes32);
}
