require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");

if (!process.env.ALCHEMY_URL) {
  throw new Error("Set ALCHEMY_URL environment variable in .env");
}
const alchemyUrl = process.env.ALCHEMY_URL;

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

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
        blockNumber: 12418695,
      },
    },
  },
};
