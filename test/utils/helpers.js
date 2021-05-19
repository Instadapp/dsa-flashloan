const hre = require("hardhat");

const { network, ethers, web3 } = hre;

// util functions
async function impersonateAccounts(accounts) {
  for (account of accounts) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [account],
    });
  }
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

async function deployConnector({ contract, signer, instaPool }) {
  const ConnectorInstance = await ethers.getContractFactory(contract, signer);
  const connectorInstance = await ConnectorInstance.deploy(instaPool.address);
  await connectorInstance.deployed();

  return connectorInstance;
}

// MAKER SPECIFIC Functions
function getMakerContract(signer) {
  const MAKER_ADDR = "0x5ef30b9986345249bc32d8928B7ee64DE9435E39";
  return ethers.getContractAt("ManagerLike", MAKER_ADDR, signer);
}

async function openMakerVault(signer) {
  const maker = await getMakerContract(signer);

  const ilk = ethers.utils.formatBytes32String("ETH-A");
  const vault = await maker.open(ilk, signer.address);

  await vault.wait();

  const lastVaultId = await maker.last(signer.address);

  return lastVaultId;
}

async function transferMakerVault(vaultId, newAddr, signer) {
  const maker = await getMakerContract(signer);

  await maker.give(vaultId, newAddr);
}

async function deployMaker(signer) {
  const factory = await ethers.getContractFactory("ConnectMaker", signer);
  const contract = await factory.deploy();

  await contract.deployed();

  return contract;
}

// aave specific functions
async function deployAave(signer) {
  const factory = await ethers.getContractFactory("ConnectAave", signer);
  const contract = await factory.deploy();

  await contract.deployed();

  return contract;
}

// instadapp specific functions
async function whitelistSig(fn, instapool, signer) {
  const sig = Web3.utils.keccak256(fn).slice(0, 10);
  await instapool.connect(signer).whitelistSigs([sig], [true]);
}

function encodeSpells(abis, spells) {
  const targets = spells.map((a) => a.connector);
  const calldatas = spells.map((a) => {
    const functionName = a.method;
    const abi = abis[a.connector].find((b) => {
      return b.name === functionName;
    });
    if (!abi) throw new Error("Couldn't find function");
    return web3.eth.abi.encodeFunctionCall(abi, a.args);
  });
  return [targets, calldatas];
}

function encodeFlashCastData(abis, spells, version) {
  const encodeSpellsData = encodeSpells(abis, spells);
  const targetType = Number(version) === 1 ? "address[]" : "string[]";
  let argTypes = [targetType, "bytes[]"];
  return web3.eth.abi.encodeParameters(argTypes, [
    encodeSpellsData[0],
    encodeSpellsData[1],
  ]);
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

async function createDSA(INDEX_ADDR, signer) {
  const InstaIndexABI = [
    "function build(address _owner, uint accountVersion, address _origin) public returns(address _account)",
    "event LogAccountCreated(address sender, address indexed owner, address indexed account, address indexed origin)",
  ];
  const indexContract = new ethers.Contract(INDEX_ADDR, InstaIndexABI, signer);

  const tx = await indexContract.build(signer.address, 2, signer.address);
  const addr = (await tx.wait()).events[1].args.account;

  return addr;
}

module.exports = {
  impersonateAccounts,
  deployConnector,
  openMakerVault,
  transferMakerVault,
  deployMaker,
  deployAave,
  impersonateAndTransfer,
  whitelistSig,
  encodeSpells,
  encodeFlashCastData,
  deployInstaPoolV2Implementation,
  createDSA,
};
