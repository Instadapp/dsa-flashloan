const hre = require("hardhat");
const { ethers } = hre;

module.exports = async function ({ contract, signer, instaPool }) {
  const ConnectorInstance = await ethers.getContractFactory(contract, signer);
  const connectorInstance = await ConnectorInstance.deploy(instaPool.address);
  await connectorInstance.deployed();

  return connectorInstance;
};
