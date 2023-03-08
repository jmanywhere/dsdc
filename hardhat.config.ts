import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const privateKeys = process.env.PRIVATE_KEY?.split(" ") ;

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 1337,
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
    },
    mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
    },
  }
};

export default config;
