pragma solidity ^0.6.0;

import 'erc3156/contracts/interfaces/IERC3156FlashLender.sol';
import './IERC3156BatchFlashBorrower.sol';

interface IERC3156BatchFlashLender is IERC3156FlashLender {
    function batchFlashLoan(
        IERC3156BatchFlashBorrower receiver,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata data
    ) external returns (bool);
}
