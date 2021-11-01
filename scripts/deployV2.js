const hre = require("hardhat");
const { ethers, deployments, getUnnamedAccounts } = hre;
const { deploy } = deployments;

async function main() {
    const deployer = (await getUnnamedAccounts())[0]
    let INSTA_MASTER_PROXY_ADMIN;
    let INSTA_INDEX;
    let AAVE_LENDING
    let W_CHAIN_TOKEN
    let INSTA_MASTER
    if (hre.network.name === "mainnet") {
        console.log(
            "\n\n Deploying Contracts to mainnet. Hit ctrl + c to abort"
        );
        INSTA_MASTER_PROXY_ADMIN = "0xa8c31E39e40E6765BEdBd83D92D6AA0B33f1CCC5"
        INSTA_INDEX = "0x2971AdFa57b20E5a416aE5a708A8655A9c74f723"
        AAVE_LENDING = "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"
        W_CHAIN_TOKEN = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        INSTA_MASTER = "0xa8c31E39e40E6765BEdBd83D92D6AA0B33f1CCC5"

    } else if (hre.network.name === "kovan") {
      console.log(
        "\n\n Deploying Contracts to kovan..."
      );
    } else if (hre.network.name === "matic") {
        console.log(
          "\n\n Deploying Contracts to matic..."
        );
        INSTA_MASTER_PROXY_ADMIN = "0x90cF378A297C7eF6dabeD36eA5E112c6646BB3A4"
        INSTA_INDEX = "0xA9B99766E6C676Cf1975c0D3166F96C0848fF5ad"
        AAVE_LENDING = "0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf"
        W_CHAIN_TOKEN = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
        INSTA_MASTER = "0x90cF378A297C7eF6dabeD36eA5E112c6646BB3A4"
    } else if (hre.network.name === "avax") {
      console.log(
        "\n\n Deploying Contracts to avax..."
      );
      INSTA_MASTER_PROXY = "0xa471D83e526B6b5D6c876088D34834B44D4064ff"
      INSTA_INDEX = "0x6CE3e607C808b4f4C26B7F6aDAeB619e49CAbb25"
      AAVE_LENDING = "0x4F01AeD16D97E3aB5ab2B501154DC9bb0F1A5A2C"
      W_CHAIN_TOKEN = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
      INSTA_MASTER = "0x3A4A2540Df5aB4Ef5503bbfBFec31ce7474B056f"
  }


  const instaAdminProxy = await deploy("InstaAdminProxy", {
      from: deployer,
      args: [INSTA_MASTER_PROXY_ADMIN]
  })
  console.log("InstaAdminProxy deployed: ", instaAdminProxy.address);
    console.log("InstaPoolV2Implementation deployed: ", instaPoolV2ImplementationV2.address);

    const instaPoolV2 = await deploy("InstaPoolV2", {
        from: deployer,
        args: [instaPoolV2ImplementationV2.address, instaAdminProxy.address, "0x"]
    })
    console.log("InstaPoolV2 deployed: ", instaPoolV2.address);
    
    const sigs = ['0x9304c934']

    const InstaPoolV2Proxy = await ethers.getContractAt("InstaPoolV2ImplementationV2", instaPoolV2.address);
    await InstaPoolV2Proxy.initialize(sigs, INSTA_MASTER)

    if (hre.network.name === "mainnet" || hre.network.name === "kovan" || hre.network.name == "matic") {
      await hre.run("verify:verify", {
        address: instaAdminProxy.address,
        constructorArguments: [INSTA_MASTER_PROXY_ADMIN],
        contract: "contracts/proxy/proxyAdmin.sol:InstaAdminProxy"
      }
    )  
      
      await hre.run("verify:verify", {
            address: instaPoolV2ImplementationV2.address,
            constructorArguments: [INSTA_INDEX, W_CHAIN_TOKEN, AAVE_LENDING]
          }
        )

        await hre.run("verify:verify", {
            address: instaPoolV2.address,
            contract: "contracts/proxy/Instapool.sol:InstaPoolV2",
            constructorArguments: [instaPoolV2ImplementationV2.address, instaAdminProxy.address, "0x"]
          }
        )

    } else if (hre.network.name === "avax") {
      await hre.run("sourcify", {
        address: instaPoolV2ImplementationV2.address,
        }
      )

      await hre.run("sourcify", {
          address: instaPoolV2.address,
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