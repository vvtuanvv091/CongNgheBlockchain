// scripts/deploy-and-test.js
import hre from "hardhat";
import { parseEther, formatEther, createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import fs from "fs";
import path from "path";

const ADMIN_KEY  = "0x7fa342a44d06c1a06d5e9e56b81c69f3f07294b560efb30b289eb2b43cc3577c";
const SELLER_KEY = "0x99b76d16eae0ce775334edfda1669d0a1f4c13f0deeab73a7d9732bc376d6f86";
const BUYER_KEY  = "0x0d85f27241127df5dcc3692e384ff0a03719e923691b5a83c551a56d83f04d35";
const RPC_URL    = "https://eth-sepolia.g.alchemy.com/v2/Emd2J4MF7HEDShTiR6cZr";

async function main() {
  const adminAccount  = privateKeyToAccount(ADMIN_KEY);
  const sellerAccount = privateKeyToAccount(SELLER_KEY);
  const buyerAccount  = privateKeyToAccount(BUYER_KEY);

  console.log("========== NFT MARKETPLACE - SEPOLIA ==========");
  console.log("Admin:  ", adminAccount.address);
  console.log("Seller: ", sellerAccount.address);
  console.log("Buyer:  ", buyerAccount.address);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

  const adminClient  = createWalletClient({ account: adminAccount,  chain: sepolia, transport: http(RPC_URL) });
  const sellerClient = createWalletClient({ account: sellerAccount, chain: sepolia, transport: http(RPC_URL) });
  const buyerClient  = createWalletClient({ account: buyerAccount,  chain: sepolia, transport: http(RPC_URL) });

  // ===== BƯỚC 1: DEPLOY =====
  console.log("\n[BUOC 1] Deploying contract...");
  const artifactPath = path.resolve("artifacts/contracts/NFTMarketplace.sol/NFTMarketplace.json");
  const artifact     = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi          = artifact.abi;
  const bytecode     = artifact.bytecode;

  const deployHash = await adminClient.deployContract({ abi, bytecode, args: [] });
  console.log("  TX deploy:", deployHash);
  console.log("  Chờ confirm...");

  const receipt       = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress;
  console.log("  ✅ Contract deployed:", contractAddress);

  // Helper write
  async function write(client, functionName, args, value) {
    const hash = await client.writeContract({
      address: contractAddress, abi, functionName, args,
      ...(value ? { value } : {}),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // Helper read
  async function read(functionName, args = []) {
    return publicClient.readContract({ address: contractAddress, abi, functionName, args });
  }

  // ===== BƯỚC 2: ĐĂNG KÝ =====
  console.log("\n[BUOC 2] Dang ky nguoi dung...");
  // Admin đã tự đăng ký trong constructor → bỏ qua
  await write(sellerClient, "register", ["Kim Anh",   2]);
  console.log("  ✅ Seller: Kim Anh");
  await write(buyerClient,  "register", ["Ngoc Tuan", 1]);
  console.log("  ✅ Buyer: Ngoc Tuan");

  // ===== BƯỚC 3: MINT NFT  ✅ Thêm tham số audioURI =====
  console.log("\n[BUOC 3] Seller mint NFT...");

  // NFT có cả ảnh + audio
  await write(sellerClient, "mintNFT", [
    "Anh Thoi Nhan Nhuong #001",
    "NFT so 1 co nhac nen",
    "ipfs://QmDragon001Image",
    "ipfs://QmDragon001Audio"    // ✅ audioURI
  ]);
  console.log("  ✅ NFT #1 (có ảnh + audio)");

  // NFT chỉ có ảnh, không có audio
  await write(sellerClient, "mintNFT", [
    "Neon Tiger #001",
    "Ho neo sang ruc",
    "ipfs://QmTiger001Image",
    ""                           // ✅ Không có audio → để ""
  ]);
  console.log("  ✅ NFT #2 (chỉ có ảnh)");

  // NFT có ảnh + audio nhưng chưa đăng bán
  await write(sellerClient, "mintNFT", [
    "Galaxy Fox #001",
    "Cao be ngan ha",
    "ipfs://QmFox001Image",
    "ipfs://QmFox001Audio"       // ✅ audioURI
  ]);
  console.log("  ✅ NFT #3 (chưa đăng bán, có audio)");

  // ===== BƯỚC 4: ĐĂNG BÁN =====
  console.log("\n[BUOC 4] Seller dang ban...");
  await write(sellerClient, "listNFT", [1n, parseEther("0.05")]);
  console.log("  ✅ NFT #1: 0.05 ETH");
  await write(sellerClient, "listNFT", [2n, parseEther("0.08")]);
  console.log("  ✅ NFT #2: 0.08 ETH");

  // ===== BƯỚC 5: XEM DANH SÁCH =====
  const listed = await read("getListedNFTs");
  console.log("\n[BUOC 5] NFT dang ban:", listed.map(id => `#${id}`).join(", "));

  // ===== BƯỚC 6: MUA =====
  console.log("\n[BUOC 6] Buyer mua NFT #1...");
  await write(buyerClient, "buyNFT", [1n]);
  console.log("  ✅ Mua thanh cong");

  // ===== BƯỚC 7: THÔNG TIN NFT  ✅ In thêm audioURI =====
  console.log("\n===== THONG TIN NFT =====");
  for (let i = 1n; i <= 3n; i++) {
    const nft = await read("getNFT", [i]);
    // getNFT trả về: [name, desc, imageURI, audioURI, creatorName, ownerName, price, status, mintedAt]
    console.log(`NFT #${i}: ${nft[0]}`);
    console.log(`  Status  : ${statusLabel(Number(nft[7]))}`);
    console.log(`  Image   : ${nft[2] || "(trống)"}`);
    console.log(`  Audio   : ${nft[3] || "(không có)"}`);   // ✅ index 3
    console.log(`  Creator : ${nft[4]} | Owner: ${nft[5]}`);
    console.log(`  Gia     : ${nft[6] > 0n ? formatEther(nft[6]) + " ETH" : "—"}`);
  }

  // ===== BƯỚC 8: LỊCH SỬ =====
  console.log("\n===== LICH SU GIAO DICH =====");
  const totalTx = await read("getTotalTransactions");
  for (let i = 1n; i <= totalTx; i++) {
    const tx = await read("transactions", [i]);
    console.log(`TX #${tx[0]}: NFT #${tx[1]} | ${tx[2].slice(0,10)}... -> ${tx[3].slice(0,10)}... | ${formatEther(tx[4])} ETH`);
  }

  // ===== BƯỚC 9: TEST ADMIN XÓA AUDIO =====
  console.log("\n[BUOC 9] Admin xoa audio NFT #3...");
  await write(adminClient, "adminDeleteMedia", [3n, "audio"]);
  const nft3 = await read("getNFT", [3n]);
  console.log(`  Audio sau xoa: "${nft3[3]}" (phai la chuoi rong)`);
  console.log("  ✅ Admin xoa audio thanh cong");

  console.log("\n✅ HOAN THANH!");
  console.log("==============================================");
  console.log("👉 Thay trong scripts.js:");
  console.log(`const CONTRACT_ADDRESS = "${contractAddress}";`);
  console.log("==============================================");
}

function statusLabel(n) {
  return ["Minted", "ForSale", "Sold"][n] ?? "Unknown";
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });