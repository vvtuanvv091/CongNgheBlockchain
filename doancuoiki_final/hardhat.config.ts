import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1"
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op"
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: "https://eth-sepolia.g.alchemy.com/v2/Emd2J4MF7HEDShTiR6cZr",
      accounts: [
        "0x7fa342a44d06c1a06d5e9e56b81c69f3f07294b560efb30b289eb2b43cc3577c",
        "0x99b76d16eae0ce775334edfda1669d0a1f4c13f0deeab73a7d9732bc376d6f86",
        "0x0d85f27241127df5dcc3692e384ff0a03719e923691b5a83c551a56d83f04d35"
      ]
    }
  },
};

export default config;