import { 
    IndexInterface,
    ListInterface,
    TokenInterface,
    Account,
    Actions,
    Types,
    ISoloMargin
} from "./interfaces.sol";

import { DSMath } from "../../libs/math.sol";


contract Setup {
    IndexInterface public constant instaIndex = IndexInterface(0x2971AdFa57b20E5a416aE5a708A8655A9c74f723);
    ListInterface public constant instaList = ListInterface(0x4c8a1BEb8a87765788946D6B19C6C6355194AbEb);

    address public constant soloAddr = 0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e;
    address public constant wethAddr = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address public constant ethAddr = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address public constant daiAddr = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    TokenInterface wethContract = TokenInterface(wethAddr);
    TokenInterface daiContract = TokenInterface(daiAddr);
    ISoloMargin solo = ISoloMargin(soloAddr);

    address public makerConnect;
    uint256 public vaultId;
    mapping (bytes4 => bool) whitelistedSigs;


    /**
    * @dev modifier to check if msg.sender is a master 
    */
    modifier isMaster() {
        require(msg.sender == instaIndex.master(), "not-master");
        _;
    }

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
    * @dev modifier to check if data's sig is whitelisted
    */
    modifier isWhitelisted(bytes memory _data) {
        require(whitelistedSigs[convertDataToSig(_data)], "sig-not-whitelisted");
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
        address sender;
        uint route;
        address token;
        uint256 amount;
        string[] dsaTargets;
        bytes[] dsaData;
    }
}

contract Helper is Setup, DSMath {
    function convertTo18(uint256 _amt, uint _dec) internal pure returns (uint256 amt) {
        amt = mul(_amt, 10 ** (18 - _dec));
    }

    function encodeDsaCastData(
        address dsa,
        uint route,
        address token,
        uint amount,
        bytes memory data
    ) internal pure returns (bytes memory _data) {
        CastData memory cd;
        (cd.dsaTargets, cd.dsaData, cd.sender) = abi.decode(
            data,
            (string[], bytes[], address)
        );
        _data = abi.encode(dsa,  cd.sender, route, token, amount, cd.dsaTargets, cd.dsaData);
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

    function masterSpell(address _target, bytes calldata _data) external isMaster {
        spell(_target, _data);
    }

    function selectBorrow(uint256 route, uint256 amt) internal {
        if (route == 0) {
            return;
        } else if (route == 1) {
            bytes memory _dataOne = abi.encodeWithSignature("deposit(uint256,uint256)", vaultId, uint(-1));
            bytes memory _dataTwo = abi.encodeWithSignature("borrow(uint256,uint256)", vaultId, amt);
            spell(makerConnect, _dataOne);
            spell(makerConnect, _dataTwo);
        } else {
            revert("route-not-found");
        }
    }

    function selectPayback(uint256 route) internal {
        if (route == 0) {
            return;
        } else if (route == 1) {
            bytes memory _dataOne = abi.encodeWithSignature("payback(uint256,uint256)", vaultId, uint(-1));
            bytes memory _dataTwo = abi.encodeWithSignature("withdraw(uint256,uint256)", vaultId, uint(-1));
            spell(makerConnect, _dataOne);
            spell(makerConnect, _dataTwo);
        } else {
            revert("route-not-found");
        }
    }
}