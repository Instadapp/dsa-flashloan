const { ethers, network } = require("hardhat");
const web3 = require("web3");
const chai = require("chai");
const chaiPromise = require("chai-as-promised");
const { solidity } = require("ethereum-waffle");

chai.use(chaiPromise);
chai.use(solidity);

// External Address
const MAKER_ADDR = "0x5ef30b9986345249bc32d8928B7ee64DE9435E39";
const TOKEN_ADDR = {
  USDC: {
    contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    holder: "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7",
  },
  WETH: {
    contract: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    holder: "0x2f0b23f53734252bda2277357e97e1517d6b042a",
  },
  DAI: {
    contract: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    holder: "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7",
  },
};

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
  const sig = web3.utils
    .keccak256("addImplementation(address,bytes4[])")
    .slice(0, 10);

  const instaImplementationsContract = new ethers.Contract(
    INSTA_IMPL_ADDR,
    instaImplementationABI,
    signer
  );

  await instaImplementationsContract.addImplementation(m2Addr, [sig]);
}

function createDSA(signer) {
  const indexContract = new ethers.Contract(INDEX_ADDR, InstaIndexABI, signer);

  return indexContract.build(signer.address, 2, signer.address);
}

describe("Flashloan", function () {
  ////
  let master, acc;

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

    const vaultId = await openVault(master);
    const makerConnector = await deployMaker(master);
    const instaPool = await deployInstaPoolV2(
      vaultId,
      makerConnector.address,
      master
    );

    // Deposit some tokens
    await Promise.all(
      Object.values((token) =>
        impersonateAndTransfer(10, token, instaPool.address)
      )
    );

    // add 1eth in each
    await acc.sendTransaction({
      from: acc.address,
      to: instaPool.address,
      value: ethers.utils.parseEther("1").toHexString(),
    });

    await transferVault(vaultId, instaPool.address, master);

    const m2Impl = await deployM2Contract(instaPool.address, master);
    await addImplementation(m2Impl.address, master);

    const dsa = await createDSA(master);
  });

  it("jethro", () => {});
});
