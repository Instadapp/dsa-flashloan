const hre = require("hardhat");
const { expect } = require("chai");
const { ethers, network, waffle, web3 } = hre;
const chai = require("chai");
const chaiPromise = require("chai-as-promised");
const { solidity } = require("ethereum-waffle");
const abis = require("./utils/abi");

chai.use(chaiPromise);
chai.use(solidity);

// External Address
const MAKER_ADDR = "0x5ef30b9986345249bc32d8928B7ee64DE9435E39";
const TOKEN_ADDR = {
  USDC: {
    contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    holder: "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
  },
  WETH: {
    contract: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    holder: "0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe",
  },
  DAI: {
    contract: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    holder: "0xf977814e90da44bfa03b6295a0616a897441acec",
  },
};
const MAX_VALUE =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";

// INSTA Address
const M1_ADDR = "0xFE2390DAD597594439f218190fC2De40f9Cf1179";
const INDEX_ADDR = "0x2971AdFa57b20E5a416aE5a708A8655A9c74f723";
const INSTA_IMPL_ADDR = "0xCBA828153d3a85b30B5b912e1f2daCac5816aE9D";

// InstaImplementations
const instaImplementationABI = [
  "function addImplementation(address _implementation, bytes4[] calldata _sigs)",
];

const InstaIndexABI = [
  "function build(address _owner, uint accountVersion, address _origin) public returns(address _account)",
  "event LogAccountCreated(address sender, address indexed owner, address indexed account, address indexed origin)",
];

async function impersonateAccounts(accounts) {
  for (account of accounts) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [account],
    });
  }
}

async function openVault(signer) {
  const maker = await ethers.getContractAt("ManagerLike", MAKER_ADDR, signer);

  const ilk = ethers.utils.formatBytes32String("ETH-A");
  const vault = await maker.open(ilk, signer.address);

  await vault.wait();

  const lastVaultId = await maker.last(signer.address);

  return lastVaultId;
}

async function transferVault(vaultId, newAddr, signer) {
  const maker = await ethers.getContractAt("ManagerLike", MAKER_ADDR, signer);

  await maker.give(vaultId, newAddr);
}

async function impersonateAndTransfer(amt, token, toAddr) {
  console.log({amt, token, toAddr})
  const signer = await ethers.getSigner(token.holder);

  const contract = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    token.contract,
    signer
  );

  await contract.transfer(toAddr, amt);
}

async function deployMaker(signer) {
  const factory = await ethers.getContractFactory("ConnectMaker", signer);
  const contract = await factory.deploy();

  await contract.deployed();

  return contract;
}

async function deployInstaPoolV2(vaultId, makerAddress, signer) {
  const factory = await ethers.getContractFactory("InstaPoolV2", signer);
  const contract = await factory.deploy(vaultId, makerAddress);

  await contract.deployed();

  return contract;
}

async function deployM2Contract(flashLoanAddr, signer) {
  const factory = await ethers.getContractFactory(
    "InstaImplementationM2",
    signer
  );
  const contract = await factory.deploy(INDEX_ADDR, M1_ADDR, flashLoanAddr);

  await contract.deployed();

  return contract;
}

async function addImplementation(m2Addr, signer) {
    const sig1 = Web3.utils
    .keccak256("flashCast(address,uint256,string[],bytes[],address)")
    .slice(0, 10);

    const sig2 = Web3.utils
    .keccak256("flashCallback(address,address,uint256,string[],bytes[],address)")
    .slice(0, 10);

  const instaImplementationsContract = new ethers.Contract(
    INSTA_IMPL_ADDR,
    instaImplementationABI,
    signer
  );

  await instaImplementationsContract.addImplementation(m2Addr, [sig1, sig2]);
}

async function createDSA(signer) {
  const indexContract = new ethers.Contract(INDEX_ADDR, InstaIndexABI, signer);

  const tx = await indexContract.build(signer.address, 2, signer.address);
  console.log("in")
  const addr = (await tx.wait()).events[1].args.account;

  return addr;
}

function encodeSpells(spells) {
  const targets = spells.map((a) => a.connector);
  const calldatas = spells.map((a) => {
    const functionName = a.method;
    // console.log(functionName)
    const abi = abis[a.connector].find((b) => {
      return b.name === functionName;
    });
    // console.log(functionName)
    if (!abi) throw new Error("Couldn't find function");
    return web3.eth.abi.encodeFunctionCall(abi, a.args);
  });
  return [targets, calldatas];
}

describe("Flashloan", function () {
  ////
  let master, acc;
  let m2Impl, dsaAddr;

  before(async () => {
    const [wallet1] = await ethers.getSigners();
    acc = wallet1
    const IndexContract = await ethers.getContractAt(
      "contracts/flashloan/Instapool/interfaces.sol:IndexInterface",
      INDEX_ADDR
    );

    const masterAddr = await IndexContract.master();

    impersonateAccounts([
      masterAddr,
      ...Object.values(TOKEN_ADDR).map((token) => token.holder),
    ]);

    master = await ethers.getSigner(masterAddr);

    const vaultId = await openVault(master);
    const makerConnector = await deployMaker(master);
    const instaPool = await deployInstaPoolV2(
      vaultId,
      makerConnector.address,
      master
    );
 
    // Deposit some tokens // TODO
    // await Promise.all(
    //   Object.values(TOKEN_ADDR).forEach(token =>
    //     impersonateAndTransfer(1000, token, instaPool.address)
    //   )
    // );

    await impersonateAndTransfer(1000, TOKEN_ADDR.DAI, instaPool.address)
    await impersonateAndTransfer(1000, TOKEN_ADDR.USDC, instaPool.address)
    await impersonateAndTransfer(1000, TOKEN_ADDR.WETH, instaPool.address)


    // add 5eth to instaPool
    await acc.sendTransaction({
      from: acc.address,
      to: instaPool.address,
      value: ethers.utils.parseEther("5").toHexString(),
    });

    await transferVault(vaultId, instaPool.address, master);

    m2Impl = await deployM2Contract(instaPool.address, master);
    await addImplementation(m2Impl.address, master);

    dsaAddr = await createDSA(master);

    m2Impl = await ethers.getContractAt(
      "InstaImplementationM2",
      dsaAddr,
      master
    );
  });

  it("flashCast with ETH", async () => {
    const ETH_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const spells = [
      {
        connector: "COMPOUND-A",
        method: "deposit",
        args: ["ETH-A", MAX_VALUE, 0, 1212],
      },
      {
        connector: "COMPOUND-A",
        method: "withdraw",
        args: ["ETH-A", 0, 1212, 0],
      }
    ];
    
    const amt = ethers.utils.parseEther("1");
    const promise = m2Impl.flashCast(
      ETH_ADDR,
      amt,
      ...encodeSpells(spells),
      master.address
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, ETH_ADDR, amt);
  });

  it("flashCast with DAI < dydx has", async () => {
    const amt = ethers.utils.parseEther("20000000");
    const spells = [
      {
        connector: "COMPOUND-A",
        method: "deposit",
        args: ["DAI-A", MAX_VALUE, 0, 12122],
      },
      {
        connector: "COMPOUND-A",
        method: "withdraw",
        args: ["DAI-A", 0, 12122, 0],
      }
    ];

    const promise = m2Impl.flashCast(
      TOKEN_ADDR.DAI.contract,
      amt,
      ...encodeSpells(spells),
      master.address
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, TOKEN_ADDR.DAI.contract, amt);
  });

  it("flashCast with DAI > dydx has", async () => {
    const amt = ethers.utils.parseEther("40000000");
    const spells = [
      {
        connector: "COMPOUND-A",
        method: "deposit",
        args: ["DAI-A", MAX_VALUE, 0, 12122],
      },
      {
        connector: "COMPOUND-A",
        method: "withdraw",
        args: ["DAI-A", 0, 12122, 0],
      }
    ];
    const promise = m2Impl.flashCast(
      TOKEN_ADDR.DAI.contract,
      amt,
      ...encodeSpells(spells),
      master.address
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, TOKEN_ADDR.DAI.contract, amt);
  });
});
