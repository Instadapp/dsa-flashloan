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
    const MAKER_VAULT_ID = 24024;
    const INSTA_MASTER_PROXY = "0xa471D83e526B6b5D6c876088D34834B44D4064ff"

    if (MAKER_VAULT_ID === 0) throw new Error("Set vault Id")

    const ctokenMapping = {
      // "ETH-A": "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
      "BAT-A": "0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e",
      "COMP-A": "0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4",
      "DAI-A": "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
      "REP-A": "0x158079ee67fce2f58472a96584a73c7ab9ac95c1",
      "UNI-A": "0x35a18000230da775cac24873d00ff85bccded550",
      "USDC-A": "0x39aa39c021dfbae8fac545936693ac917d5e7563",
      "USDT-A": "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
      "WBTC-A": "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4",
      "ZRX-A": "0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407",
      "TUSD-A": "0x12392F67bdf24faE0AF363c24aC620a2f67DAd86",
      "LINK-A": "0xFAce851a4921ce59e912d19329929CE6da6EB0c7"
    }

    const InstaPoolCompoundMapping = await ethers.getContractFactory("InstaPoolCompoundMapping");
    const instaPoolCompoundMapping = await InstaPoolCompoundMapping.deploy(Object.values(ctokenMapping));
    await instaPoolCompoundMapping.deployed();

    console.log("instaPoolCompoundMapping deployed: ", instaPoolCompoundMapping.address);

    const MakerConnector = await ethers.getContractFactory("ConnectMaker");
    const makerConnector = await MakerConnector.deploy();
    await makerConnector.deployed();

    console.log("MakerConnector deployed: ", makerConnector.address);

    const ConnectAave = await ethers.getContractFactory("ConnectAave");
    const connectAave = await ConnectAave.deploy();
    await connectAave.deployed();

    console.log("ConnectAave deployed: ", connectAave.address);

    const ConnectCompound = await ethers.getContractFactory("ConnectCompound");
    const connectCompound = await ConnectCompound.deploy();
    await connectCompound.deployed();

    console.log("ConnectCompound deployed: ", connectCompound.address);

    const InstaPoolV2Implementation = await ethers.getContractFactory("InstaPoolV2Implementation");
    const instaPoolV2Implementation = await InstaPoolV2Implementation.deploy();
    await instaPoolV2Implementation.deployed();

    console.log("InstaPoolV2Implementation deployed: ", instaPoolV2Implementation.address);

    const InstaPoolV2 = await ethers.getContractFactory("InstaPoolV2");
    const instaPoolV2 = await InstaPoolV2.deploy(instaPoolV2Implementation.address, INSTA_MASTER_PROXY, "0x");
    await instaPoolV2.deployed();

    console.log("InstaPoolV2 deployed: ", instaPoolV2.address);

    const ConnectInstaPool = await ethers.getContractFactory("ConnectInstaPool");
    const connectInstaPool = await ConnectInstaPool.deploy();
    await connectInstaPool.deployed();

    console.log("ConnectInstaPool deployed: ", connectInstaPool.address);

    const ConnectV2InstaPool = await ethers.getContractFactory("ConnectV2InstaPool");
    const connectV2InstaPool = await ConnectV2InstaPool.deploy();
    await connectV2InstaPool.deployed();

    console.log("ConnectV2InstaPool deployed: ", connectV2InstaPool.address);


    const InstaPoolV2Proxy = await ethers.getContractAt("InstaPoolV2Implementation", instaPoolV2.address);
    await InstaPoolV2Proxy.initialize(MAKER_VAULT_ID, makerConnector.address, connectAave.address)

    if (hre.network.name === "mainnet" || hre.network.name === "kovan") {
        await hre.run("verify:verify", {
            address: instaPoolCompoundMapping.address,
            constructorArguments: [Object.values(ctokenMapping)]
          }
        )

        await hre.run("verify:verify", {
            address: makerConnector.address,
            constructorArguments: []
          }
        )

        await hre.run("verify:verify", {
          address: connectAave.address,
          constructorArguments: []
        })

        await hre.run("verify:verify", {
          address: connectCompound.address,
          constructorArguments: []
        })

        await hre.run("verify:verify", {
            address: instaPoolV2Implementation.address,
            constructorArguments: [],
        })

        await hre.run("verify:verify", {
            address: instaPoolV2.address,
            constructorArguments: [instaPoolV2Implementation.address, INSTA_MASTER_PROXY, "0x"],
            contract: "contracts/proxy/Instapool.sol:InstaPoolV2"
        })

        await hre.run("verify:verify", {
          address: connectInstaPool.address,
          constructorArguments: [],
        })

        await hre.run("verify:verify", {
          address: connectV2InstaPool.address,
          constructorArguments: [],
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