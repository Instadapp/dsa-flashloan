const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    if (hre.network.name === "mainnet") {
      console.log(
        "\n\n Deploying Contracts to mainnet. Hit ctrl + c to abort"
      );
    } else if (hre.network.name === "kovan") {
      console.log(
        "\n\n Deploying Contracts to kovan..."
      );
    }
    const MAKER_VAULT_ID = 0;
    const INSTA_MASTER_PROXY = "0xa471D83e526B6b5D6c876088D34834B44D4064ff"

    if (MAKER_VAULT_ID === 0) throw new Error("Set vault Id")

    const MakerConnector = await ethers.getContractFactory("ConnectMaker");
    const makerConnector = await MakerConnector.deploy();
    await makerConnector.deployed();

    console.log("MakerConnector deployed: ", makerConnector.address);

    const InstaPoolV2Implementation = await ethers.getContractFactory("InstaPoolV2Implementation");
    const instaPoolV2Implementation = await InstaPoolV2Implementation.deploy();
    await instaPoolV2Implementation.deployed();

    console.log("InstaPoolV2Implementation deployed: ", instaPoolV2Implementation.address);

    const InstaPoolV2 = await ethers.getContractFactory("InstaPoolV2");
    const instaPoolV2 = await InstaPoolV2.deploy(instaPoolV2Implementation.address, INSTA_MASTER_PROXY, "0x");
    await instaPoolV2.deployed();

    console.log("InstaPoolV2 deployed: ", instaPoolV2.address);


    const InstaPoolV2Proxy = await ethers.getContractAt("InstaPoolV2Implementation", instaPoolV2.address);
    await InstaPoolV2Proxy.initialize(MAKER_VAULT_ID, makerConnector.address)



    if (hre.network.name === "mainnet" || hre.network.name === "kovan") {
        await hre.run("verify:verify", {
            address: makerConnector.address,
            constructorArguments: []
          }
        )

        await hre.run("verify:verify", {
            address: instaPoolV2Implementation.address,
            constructorArguments: [],
            }
        )

        await hre.run("verify:verify", {
            address: instaPoolV2.address,
            constructorArguments: [instaPoolV2Implementation.address, INSTA_MASTER_PROXY.address, "0x"],
            }
        )

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