const hre = require("hardhat");
const { ethers, network, waffle, web3 } = hre;
const chai = require("chai");
const chaiPromise = require("chai-as-promised");
const { solidity } = require("ethereum-waffle");
const abis = require("./utils/abi");
const deployConnector = require("./utils/deployConnector");

chai.use(chaiPromise);
chai.use(solidity);

const { expect } = chai;

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
  USDT: {
    contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    holder: "0x5754284f345afc66a98fbb0a0afe71e0f007b949",
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
  console.log({ amt, token, toAddr });
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

async function deployAave(signer) {
  const factory = await ethers.getContractFactory("ConnectAave", signer);
  const contract = await factory.deploy();

  await contract.deployed();

  return contract;
}

async function deployInstaPoolV2Implementation(
  vaultId,
  makerAddress,
  aaveAddress,
  signer
) {
  const factory = await ethers.getContractFactory(
    "InstaPoolV2Implementation",
    signer
  );
  const contract = await factory.deploy();

  await contract.deployed();

  await contract.initialize(vaultId, makerAddress, aaveAddress);

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
    .keccak256("cast(string[],bytes[],address,address,uint256)")
    .slice(0, 10);

  const sig2 = Web3.utils
    .keccak256(
      "flashCallback(address,address,uint256,string[],bytes[],address)"
    )
    .slice(0, 10);

  const instaImplementationsContract = new ethers.Contract(
    INSTA_IMPL_ADDR,
    instaImplementationABI,
    signer
  );

  await instaImplementationsContract.addImplementation(m2Addr, [sig1, sig2]);
}

async function whitelistSigs(fn, instapool, signer) {
  const sig2 = Web3.utils.keccak256(fn).slice(0, 10);
  await instapool.connect(signer).whitelistSigs([sig2], [true]);
}

async function createDSA(signer) {
  const indexContract = new ethers.Contract(INDEX_ADDR, InstaIndexABI, signer);

  const tx = await indexContract.build(signer.address, 2, signer.address);
  console.log("in");
  const addr = (await tx.wait()).events[1].args.account;

  return addr;
}

function encodeSpells(spells) {
  const targets = spells.map((a) => a.connector);
  const calldatas = spells.map((a) => {
    const functionName = a.method;
    console.log(functionName)
    const abi = abis[a.connector].find((b) => {
      return b.name === functionName;
    });
    console.log(functionName)
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
    acc = wallet1;
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
    const aaveConnector = await deployAave(master);
    const instaPool = await deployInstaPoolV2Implementation(
      vaultId,
      makerConnector.address,
      aaveConnector.address,
      master
    );

    // Deposit some tokens // TODO
    // await Promise.all(
    //   Object.values(TOKEN_ADDR).forEach(token =>
    //     impersonateAndTransfer(1000, token, instaPool.address)
    //   )
    // );

    await impersonateAndTransfer(1000, TOKEN_ADDR.DAI, instaPool.address);
    await impersonateAndTransfer(1000, TOKEN_ADDR.USDC, instaPool.address);
    await impersonateAndTransfer(1000, TOKEN_ADDR.WETH, instaPool.address);
    await impersonateAndTransfer(1000, TOKEN_ADDR.USDT, instaPool.address);

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

    await whitelistSigs(
      "flashCallback(address,address,uint256,string[],bytes[],address)",
      instaPool,
      master
    );
  });

  it("flashCast with ETH", async () => {
    const ETH_ADDR = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    // const spells = [
    //   {
    //     connector: "COMPOUND-A",
    //     method: "deposit",
    //     args: ["ETH-A", MAX_VALUE, 0, 1212],
    //   },
    //   {
    //     connector: "COMPOUND-A",
    //     method: "withdraw",
    //     args: ["ETH-A", 0, 1212, 0],
    //   },
    // ];

    const spells = [
      {
        connector: "COMPOUND-A",
        method: "depositCToken",
        args: ["ETH-A", MAX_VALUE, 0, 123312],
      },
      {
        connector: "COMPOUND-A",
        method: "withdrawCToken",
        args: ["ETH-A", MAX_VALUE, 0, 0],
      },
    ];

    const amt = "45547657732544334267823";
    const promise = m2Impl.cast(
      ...encodeSpells(spells),
      master.address,
      ETH_ADDR,
      amt
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, ETH_ADDR, amt);
  });

  it("flashCast with DAI < dydx has", async () => {
    const amt = "25657657732544334267823451";
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
      },
    ];

    const promise = m2Impl.cast(
      ...encodeSpells(spells),
      master.address,
      TOKEN_ADDR.DAI.contract,
      amt
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, TOKEN_ADDR.DAI.contract, amt);
  });

  it("flashCast with DAI > dydx has", async () => {
    const amt = "45657657732544334267823451";
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
      },
    ];
    const promise = m2Impl.cast(
      ...encodeSpells(spells),
      master.address,
      TOKEN_ADDR.DAI.contract,
      amt
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, TOKEN_ADDR.DAI.contract, amt);
  });

  it("flashCast with USDT has", async () => {
    const amt = "456537823451";
    const spells = [
      {
        connector: "COMPOUND-A",
        method: "deposit",
        args: ["USDT-A", MAX_VALUE, 0, 12122],
      },
      {
        connector: "COMPOUND-A",
        method: "withdraw",
        args: ["USDT-A", 0, 12122, 0],
      },
    ];
    const promise = m2Impl.cast(
      ...encodeSpells(spells),
      master.address,
      TOKEN_ADDR.USDT.contract,
      amt
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, TOKEN_ADDR.USDT.contract, amt);
  });
});

function encodeFlashCastData(spells, version) {
  const encodeSpellsData = encodeSpells(spells);
  const targetType = Number(version) === 1 ? "address[]" : "string[]";
  let argTypes = [targetType, "bytes[]"];
  return web3.eth.abi.encodeParameters(argTypes, [
    encodeSpellsData[0],
    encodeSpellsData[1],
  ]);
}

describe("ConnectV2InstaPool connector", () => {
  const connectorName = "INSTAPOOL-V2";
  const contractName = "ConnectV2InstaPool";
  let master, acc, connectorAddr;
  let indexContract, instaConnectors, instaPool, m1Impl;

  before(async () => {
    const [wallet1] = await ethers.getSigners();
    acc = wallet1;
    indexContract = await ethers.getContractAt(
      "contracts/flashloan/Instapool/interfaces.sol:IndexInterface",
      INDEX_ADDR
    );

    const masterAddr = await indexContract.master();

    await impersonateAccounts([masterAddr]);

    master = await ethers.getSigner(masterAddr);

    const instaConnectorsFactory = await ethers.getContractFactory(
      "InstaConnectorsV2",
      master
    );
    instaConnectors = await instaConnectorsFactory.deploy(
      indexContract.address
    );

    await instaConnectors.deployed();

    const vaultId = await openVault(master);
    const makerConnector = await deployMaker(master);
    const aaveConnector = await deployAave(master);
    instaPool = await deployInstaPoolV2Implementation(
      vaultId,
      makerConnector.address,
      aaveConnector.address,
      master
    );

    const connector = await deployConnector({
      contract: contractName,
      signer: master,
      instaPool,
    });

    connectorAddr = connector.address;

    const tx = await instaConnectors
      .connect(master)
      .addConnectors([connectorName], [connectorAddr]);

    await tx.wait();
  });

  it("should cast the spells", async () => {
    const DAI_ADDR = "0x6b175474e89094c44da98b954eedeac495271d0f";
    const amt = "25657657732544334267823451";
    const spells = [
      {
        connector: "COMPOUND-A",
        method: "deposit",
        args: ["USDT-A", MAX_VALUE, 0, 12122],
      },
      {
        connector: "COMPOUND-A",
        method: "withdraw",
        args: ["USDT-A", 0, 12122, 0],
      },
      {
        connector: connectorName,
        method: "flashPayback",
        args: [DAI_ADDR, amt, 0, 0],
      },
    ];

    const calldata = encodeFlashCastData(spells);
    console.log("calldata", calldata)

    const flashSpells = [
      {
        connector: connectorName,
        method: "flashBorrowAndCast",
        args: [DAI_ADDR, amt, 0, calldata],
      },
    ];

    // create DSA
    const dsa = await createDSA(master);

    // add m1 impl
    m1Impl = await ethers.getContractAt("InstaImplementationM1", dsa.address);

    // white listed
    await whitelistSigs("cast(string[],bytes[],address)", instaPool, master);

    // m1Impl.cast(...encodeSpells(flashSpells), "0x")
    await m1Impl.cast(...encodeSpells(flashSpells), master.address);
  });
});
