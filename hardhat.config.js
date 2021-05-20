require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-etherscan");


if (!process.env.ALCHEMY_URL) {
  throw new Error("Set ALCHEMY_URL environment variable in .env");
}
const alchemyUrl = process.env.ALCHEMY_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const { utils } = require("ethers");


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  mocha: {
    timeout: 100000,
  },
  solidity: {
    compilers: [{ version: "0.6.2" }, { version: "0.7.0" }],
  },
  networks: {
    hardhat: {
      forking: {
        url: alchemyUrl,
        blockNumber: 12460086,
      },
    },
    mainnet: {
      url: alchemyUrl,
      accounts: [`0x${PRIVATE_KEY}`],
      timeout: 150000,
      gasPrice: parseInt(utils.parseUnits("67", "gwei"))
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN
  }
};
