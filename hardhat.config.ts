import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";


const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 1337,
      forking: {
        url: "https://bscrpc.com",
        blockNumber: 26301200,
      },
    },
  }
};

export default config;
