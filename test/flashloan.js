const hre = require("hardhat");
const { ethers, waffle, web3 } = hre;
const chai = require("chai");
const chaiPromise = require("chai-as-promised");
const { solidity } = require("ethereum-waffle");
const abis = require("./utils/abi");
const {
  impersonateAccounts,
  impersonateAndTransfer,
  deployConnector,
  openMakerVault,
  transferMakerVault,
  deployMaker,
  deployAave,
  whitelistSig,
  encodeSpells,
  encodeFlashCastData,
  deployInstaPoolV2Implementation,
  createDSA,
} = require("./utils/helpers");
const {
  TOKEN_ADDR,
  MAX_VALUE,
  M1_ADDR,
  INDEX_ADDR,
  INSTA_IMPL_ADDR,
} = require("./utils/constants");

chai.use(chaiPromise);
chai.use(solidity);

const { expect } = chai;

describe("Flashloan", function () {
  // mutable variables
  let master, acc;
  let m2Impl, dsaAddr;

  // helper functions
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
    const instaImplementationABI = [
      "function addImplementation(address _implementation, bytes4[] calldata _sigs)",
    ];

    const sigs = [
      Web3.utils
        .keccak256("cast(string[],bytes[],address,address,uint256)")
        .slice(0, 10),
      Web3.utils
        .keccak256(
          "flashCallback(address,address,uint256,string[],bytes[],address)"
        )
        .slice(0, 10),
    ];

    const instaImplementationsContract = new ethers.Contract(
      INSTA_IMPL_ADDR,
      instaImplementationABI,
      signer
    );

    await instaImplementationsContract.addImplementation(m2Addr, sigs);
  }

  before(async () => {
    [acc] = await ethers.getSigners();
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

    const vaultId = await openMakerVault(master);
    const makerConnector = await deployMaker(master);
    const aaveConnector = await deployAave(master);
    const instaPool = await deployInstaPoolV2Implementation(
      vaultId,
      makerConnector.address,
      aaveConnector.address,
      master
    );

    // deposit some tokens
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

    await transferMakerVault(vaultId, instaPool.address, master);

    m2Impl = await deployM2Contract(instaPool.address, master);
    await addImplementation(m2Impl.address, master);

    dsaAddr = await createDSA(INDEX_ADDR, master);

    m2Impl = await ethers.getContractAt(
      "InstaImplementationM2",
      dsaAddr,
      master
    );

    await whitelistSig(
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
      ...encodeSpells(abis, spells),
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
      ...encodeSpells(abis, spells),
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
      ...encodeSpells(abis, spells),
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
      ...encodeSpells(abis, spells),
      master.address,
      TOKEN_ADDR.USDT.contract,
      amt
    );

    await expect(promise)
      .to.emit(m2Impl, "LogFlashCast")
      .withArgs(master.address, TOKEN_ADDR.USDT.contract, amt);
  });
});

describe("ConnectV2InstaPool connector", () => {
  const connectorName = "INSTAPOOL-V2";
  const contractName = "ConnectV2InstaPool";
  let master, acc, connectorAddr;
  let indexContract, instaConnectors, instaPool, m1Impl;

  before(async () => {
    [acc] = await ethers.getSigners();
    indexContract = await ethers.getContractAt(
      "contracts/flashloan/Instapool/interfaces.sol:IndexInterface",
      INDEX_ADDR
    );

    const masterAddr = await indexContract.master();

    await impersonateAccounts([masterAddr]);

    master = await ethers.getSigner(masterAddr);

    instaConnectors = await ethers.getContractAt(
      "InstaConnectorsV2",
      "0x97b0B3A8bDeFE8cB9563a3c610019Ad10DB8aD11",
      master
    );

    const vaultId = await openMakerVault(master);
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

    await impersonateAndTransfer(1000, TOKEN_ADDR.DAI, instaPool.address);
    await impersonateAndTransfer(1000, TOKEN_ADDR.USDC, instaPool.address);
    await impersonateAndTransfer(1000, TOKEN_ADDR.WETH, instaPool.address);
    await impersonateAndTransfer(1000, TOKEN_ADDR.USDT, instaPool.address);

    const tx = await instaConnectors
      .connect(master)
      .addConnectors([connectorName], [connectorAddr]);

    await tx.wait();
  });

  it("should cast the spells", async () => {
    const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const amt = "25653423451";
    const spells = [
      {
        connector: "COMPOUND-A",
        method: "deposit",
        args: ["USDT-A", MAX_VALUE, 0, 12122],
      },
      {
        connector: "COMPOUND-A",
        method: "withdraw",
        args: ["USDT-A", 0, 12122, 3487],
      },
      {
        connector: connectorName,
        method: "flashPayback",
        args: [USDT_ADDR, 0, 3487, 0],
      },
    ];

    const calldata = encodeFlashCastData(abis, spells, 2);

    const flashSpells = [
      {
        connector: connectorName,
        method: "flashBorrowAndCast",
        args: [USDT_ADDR, amt, 0, calldata],
      },
    ];

    // create DSA
    const dsa = await createDSA(INDEX_ADDR, master);

    // add m1 impl
    m1Impl = await ethers.getContractAt("InstaImplementationM1", dsa, master);

    // white listed
    await whitelistSig("cast(string[],bytes[],address)", instaPool, master);

    await m1Impl.cast(...encodeSpells(abis, flashSpells), master.address);
  });
});
