const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    let INSTA_MASTER_PROXY;
    let INSTA_INDEX;
    let AAVE_LENDING
    let W_CHAIN_TOKEN
    let INSTA_MASTER
    if (hre.network.name === "mainnet") {
        console.log(
            "\n\n Deploying Contracts to mainnet. Hit ctrl + c to abort"
        );
        INSTA_MASTER_PROXY = "0xa471D83e526B6b5D6c876088D34834B44D4064ff"

    } else if (hre.network.name === "kovan") {
      console.log(
        "\n\n Deploying Contracts to kovan..."
      );
    } else if (hre.network.name === "matic") {
        console.log(
          "\n\n Deploying Contracts to matic..."
        );
        INSTA_MASTER_PROXY = "0x697860CeE594c577F18f71cAf3d8B68D913c7366"
        INSTA_INDEX = "0xA9B99766E6C676Cf1975c0D3166F96C0848fF5ad"
        AAVE_LENDING = "0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf"
        W_CHAIN_TOKEN = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"
        INSTA_MASTER = "0x90cF378A297C7eF6dabeD36eA5E112c6646BB3A4"
    }

    const InstaPoolV2Implementation = await ethers.getContractFactory("InstaPoolV2ImplementationV2");
    const instaPoolV2Implementation = await InstaPoolV2Implementation.deploy(INSTA_INDEX, W_CHAIN_TOKEN, AAVE_LENDING);
    await instaPoolV2Implementation.deployed();

    console.log("InstaPoolV2Implementation deployed: ", instaPoolV2Implementation.address);

    const InstaPoolV2 = await ethers.getContractFactory("InstaPoolV2");
    const instaPoolV2 = await InstaPoolV2.deploy(instaPoolV2Implementation.address, INSTA_MASTER_PROXY, "0x");
    await instaPoolV2.deployed();

    console.log("InstaPoolV2 deployed: ", instaPoolV2.address);

    const ConnectV2InstaPool = await ethers.getContractFactory("ConnectV2InstaPoolV2");
    const connectV2InstaPool = await ConnectV2InstaPool.deploy(instaPoolV2.address);
    await connectV2InstaPool.deployed();

    console.log("ConnectV2InstaPool deployed: ", connectV2InstaPool.address);

    const sigs = ['0x9304c934']

    const InstaPoolV2Proxy = await ethers.getContractAt("InstaPoolV2ImplementationV2", instaPoolV2.address);
    await InstaPoolV2Proxy.initialize(sigs, INSTA_MASTER)

    if (hre.network.name === "mainnet" || hre.network.name === "kovan" || hre.network.name == "matic") {
        await hre.run("verify:verify", {
            address: instaPoolV2Implementation.address,
            constructorArguments: [INSTA_INDEX, W_CHAIN_TOKEN, AAVE_LENDING]
          }
        )

        await hre.run("verify:verify", {
            address: instaPoolV2.address,
            contract: "contracts/proxy/Instapool.sol:InstaPoolV2",
            constructorArguments: [instaPoolV2Implementation.address, INSTA_MASTER_PROXY, "0x"]
          }
        )

        await hre.run("verify:verify", {
          address: connectV2InstaPool.address,
          constructorArguments: [instaPoolV2.address]
        })

    } else {
      console.log("Contracts deployed to hardhat")
    }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });