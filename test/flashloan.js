const { ethers, network } = require("hardhat");
const chai = require("chai");
const chaiPromise = require("chai-as-promised");
const { solidity } = require("ethereum-waffle");

chai.use(chaiPromise);
chai.use(solidity);

// External Address
const MAKER_ADDR = "0x839c2D3aDe63DF5b0b8F3E57D5e145057Ab41556";
const USDC_ADDR = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH_ADDR = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const DAI_ADDR = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

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

async function openVault(signer) {
  const maker = await ethers.getContractAt("ManagerLike", MAKER_ADDR, signer);

  const ilk = ethers.utils.formatBytes32String("ETH-A");
  const vaultId = await maker.open(ilk, signer.address);

  return vaultId;
}

async function transferVault(vaultId, newAddr, signer) {
  const maker = await ethers.getContractAt("ManagerLike", MAKER_ADDR, signer);

  await maker.give(vaultId, newAddr);
}

async function erc20Transfer(amt, contractAddr, toAddr) {
  const contract = await ethers.getContractAt("IERC20", contractAddr);

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

  await contract.deploy();

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

  return indexContract.addImplementation(signer.address, 2, signer.address);
}

describe("Flashloan", function () {
  ////
  let master, acc;

  before(async () => {
    [acc] = await ethers.getSigners();

    const IndexContract = await ethers.getContractAt(
      "IndexInterface",
      INDEX_ADDR
    );

    const masterAddr = await IndexContract.master();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [masterAddr],
    });

    master = await ethers.getSigner(masterAddress);

    const vaultId = await openVault(master);
    const makerConnector = await deployMaker(master);
    const instaPool = await deployInstaPoolV2(
      vaultId,
      makerConnector.address,
      master
    );

    // Deposit some tokens
    await erc20Transfer(10, USDC_ADDR, instaPool.address);
    await erc20Transfer(10, WETH_ADDR, instaPool.address);
    await erc20Transfer(10, DAI_ADDR, instaPool.address);

    await account.sendTransaction({
      from: account.address,
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
