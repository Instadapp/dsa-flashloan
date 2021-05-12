pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import { InstaFlashV2Interface } from "./interfaces.sol";

contract Variables {

    /**
    * @dev Instapool / Receiver contract proxy
    */
    InstaFlashV2Interface public constant instaPool = InstaFlashV2Interface(0x4A090897f47993C2504144419751D6A91D79AbF4);
}