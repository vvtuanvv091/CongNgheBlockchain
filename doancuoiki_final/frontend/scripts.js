/* ════════════════════════════════════════════════════════════════
   NFT MARKETPLACE - scripts.js
   Kết nối Sepolia + IPFS Pinata
   ✅ v2: Audio lưu trên IPFS + on-chain (bền vững qua reload)
════════════════════════════════════════════════════════════════ */

const CONTRACT_ADDRESS = "0x5a83d63449dcb837ff4268760f4bc6e6cbad6809";

/* ════════════════════════════════
   PINATA IPFS CONFIG
════════════════════════════════ */
const PINATA_API_KEY = '804145b2ba728e7fd1cb';
const PINATA_SECRET  = 'ab3104b91b32faf5fe7ca9f4a491e77059c384e341ac872ad973860f1bbc7200';
//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIyMWNmY2YyOS05MWQ0LTQxYTMtYWZiZS1lMGNjYWM4MTVhYmEiLCJlbWFpbCI6IjE4MjIwNDA4MzNAZG50dS5lZHUudm4iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiODA0MTQ1YjJiYTcyOGU3ZmQxY2IiLCJzY29wZWRLZXlTZWNyZXQiOiJhYjMxMDRiOTFiMzJmYWY1ZmU3Y2E5ZjRhNDkxZTc3MDU5YzM4NGUzNDFhYzg3MmFkOTczODYwZjFiYmM3MjAwIiwiZXhwIjoxODA4MjY3OTA5fQ.RRPCLj0SNP8DfqogdVhxVbmV4Cp6pUvwpMGzzgz_D9k
const IPFS_GATEWAY   = 'https://gateway.pinata.cloud/ipfs/';

// ✅ ABI cập nhật: mintNFT thêm _audioURI, nfts() thêm audioURI, getNFT thêm audioURI
const CONTRACT_ABI = [
  "function register(string _username, uint8 _role) public",
  "function updateRole(address _account, uint8 _newRole) public",
  "function getUser(address _account) public view returns (string username, uint8 role, bool isRegistered, uint256 registeredAt)",
  "function deleteMyaccount() public",
  "function adminDeleteAccount(address _account) public",
  "function adminRegister(address _account, string _username, uint8 _role) public",
  // ✅ Thêm string _audioURI (tham số thứ 4)
  "function mintNFT(string _name, string _description, string _imageURI, string _audioURI) public returns (uint256)",

  "function listNFT(uint256 _tokenId, uint256 _price) public",
  "function delistNFT(uint256 _tokenId) public",
  "function buyNFT(uint256 _tokenId) public",

  // ✅ getNFT trả về audioURI ở index 3, các index sau dịch lên 1
  "function getNFT(uint256 _tokenId) public view returns (string name, string description, string imageURI, string audioURI, string creatorName, string ownerName, uint256 price, uint8 status, uint256 mintedAt)",

  "function getListedNFTs() public view returns (uint256[])",
  "function getTotalNFTs() public view returns (uint256)",
  "function getTotalTransactions() public view returns (uint256)",
  "function getTransactionsByNFT(uint256 _tokenId) public view returns (uint256[])",
  "function admin() public view returns (address)",
  "function nftCounter() public view returns (uint256)",
  "function txCounter() public view returns (uint256)",

  // ✅ nfts() getter thêm audioURI
  "function nfts(uint256) public view returns (uint256 tokenId, string name, string description, string imageURI, string audioURI, address creator, address currentOwner, uint256 price, uint8 status, uint256 mintedAt)",

  "function transactions(uint256) public view returns (uint256 txId, uint256 tokenId, address seller, address buyer, uint256 price, uint256 timestamp)",
  "function users(address) public view returns (address account, string username, uint8 role, bool isRegistered, uint256 registeredAt)",

  // ✅ adminDeleteMedia xóa cả image lẫn audio on-chain
  "function adminDeleteMedia(uint256 _tokenId, string _mediaType) public",

  "event UserRegistered(address indexed account, string username, uint8 role, uint256 timestamp)",
  "event NFTMinted(uint256 indexed tokenId, string name, address indexed creator, uint256 timestamp)",
  "event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price, uint256 timestamp)",
  "event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 timestamp)",
  "event NFTDelisted(uint256 indexed tokenId, address indexed owner, uint256 timestamp)",
  "event AccountDeleted(address indexed account, address indexed deletedBy, uint256 timestamp)",
  "event MediaDeleted(uint256 indexed tokenId, string mediaType, address deletedBy, uint256 timestamp)"
];

/* ────────────────────────────────
   STATE
──────────────────────────────── */
let provider = null;
let signer   = null;
let contract = null;
let account  = null;
let adminAddress = null;

const S = { users: {}, nfts: {}, txs: [], nftId: 0, txId: 0 };

let currentFilter = 'all';
let currentPage   = 'marketplace';
let currentNFTId  = null;

// audioAccess: kiểm soát ai nghe được (vẫn giữ local, chủ có thể toggle)
let audioAccess  = {};
let nftImageData = {};

let nftImageFile  = null;
let nftImageTemp  = null;
let audioDataTemp = null;   // { url, name, _file } — dùng tạm khi mint, sau đó lên chain

let isPlaying = false;
let playQueue = [];
let playIdx   = 0;
const audioEl = new Audio();
audioEl.ontimeupdate = updateProgress;
audioEl.onended = nextTrack;

const CHAINS = {
  '0x7a69':   'Hardhat Local',
  '0xaa36a7': 'Sepolia',
  '0x1':      'Ethereum',
  '0x89':     'Polygon'
};

/* ════════════════════════════════
   IPFS UPLOAD
════════════════════════════════ */
async function uploadToIPFS(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({ name: file.name }));
  formData.append('pinataOptions',  JSON.stringify({ cidVersion: 1 }));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'pinata_api_key': PINATA_API_KEY,
      'pinata_secret_api_key': PINATA_SECRET
    },
    body: formData
  });
  if (!res.ok) throw new Error('Pinata upload thất bại: ' + await res.text());
  const data = await res.json();
  return IPFS_GATEWAY + data.IpfsHash;
}

async function uploadMetadataToIPFS(metadata) {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'pinata_api_key': PINATA_API_KEY,
      'pinata_secret_api_key': PINATA_SECRET
    },
    body: JSON.stringify({
      pinataMetadata: { name: metadata.name + '_metadata' },
      pinataContent: metadata
    })
  });
  if (!res.ok) throw new Error('Upload metadata thất bại');
  const data = await res.json();
  return IPFS_GATEWAY + data.IpfsHash;
}

/* ════════════════════════════════
   ETHERS INIT
════════════════════════════════ */
function getEthers() {
  if (typeof ethers === 'undefined') { showToast('❌ Ethers.js chưa load!'); throw new Error('ethers not loaded'); }
  return ethers;
}

async function initContract() {
  const eth = getEthers();
  provider = new eth.BrowserProvider(window.ethereum);
  signer   = await provider.getSigner();
  contract = new eth.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  try { adminAddress = (await contract.admin()).toLowerCase(); }
  catch(e) { console.warn('Không lấy được admin:', e); }
}

/* ════════════════════════════════
   METAMASK CONNECT
════════════════════════════════ */
async function connectWallet() {
  if (!window.ethereum) {
    document.getElementById('mm-banner').classList.add('show');
    showToast('❌ Chưa cài MetaMask!'); return;
  }
  try {
    showTxModal('⏳', 'Đang kết nối...', 'Chờ MetaMask xác nhận...');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    await onAccounts(accounts);
    closeModal('modal-tx');
  } catch(e) { closeModal('modal-tx'); showToast('❌ Từ chối kết nối'); }
}

async function onAccounts(accs) {
  if (!accs || !accs.length) {
    account = null;
    document.getElementById('btn-connect').style.display = 'flex';
    document.getElementById('wallet-badge').style.display = 'none';
    return;
  }
  account = accs[0].toLowerCase();
  document.getElementById('btn-connect').style.display = 'none';
  document.getElementById('wallet-badge').style.display = 'flex';
  document.getElementById('wallet-addr').textContent = account.slice(0,6) + '…' + account.slice(-4);

  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const cn = CHAINS[chainId] || 'Chain ' + parseInt(chainId, 16);
  document.getElementById('net-tag').textContent = cn;
  const safe = ['0x7a69', '0xaa36a7'].includes(chainId);
  document.getElementById('chain-warn').classList.toggle('show', !safe);

  await initContract();
  await loadAllFromChain();
  showToast('✅ Đã kết nối: ' + account.slice(0,6) + '…' + account.slice(-4));
}

function copyAddr() {
  if (!account) return;
  navigator.clipboard.writeText(account);
  showToast('📋 Đã copy địa chỉ ví!');
}

if (window.ethereum) {
  window.ethereum.on('accountsChanged', onAccounts);
  window.ethereum.on('chainChanged', () => location.reload());
  window.ethereum.request({ method: 'eth_accounts' }).then(a => { if(a.length) onAccounts(a); });
} else {
  document.getElementById('mm-banner').classList.add('show');
}

/* ════════════════════════════════
   LOAD DỮ LIỆU TỪ CHAIN
════════════════════════════════ */
async function loadAllFromChain() {
  if (!contract) return;
  try {
    showLoadingOverlay(true);
    await loadNFTs();
    await loadTransactions();
    await loadCurrentUser();
    renderAll();
    updateSidebarNFTs();
  } catch(e) {
    console.error('Lỗi load:', e);
    showToast('⚠️ Lỗi tải dữ liệu: ' + (e.reason || e.message || ''));
  } finally { showLoadingOverlay(false); }
}

// ✅ loadNFTs: đọc audioURI từ chain → tự động khôi phục sau reload
async function loadNFTs() {
  const total = Number(await contract.getTotalNFTs());
  S.nftId = total;
  S.nfts  = {};

  for (let i = 1; i <= total; i++) {
    try {
      const raw       = await contract.nfts(i);
      const ownerRaw  = await contract.users(raw.currentOwner);
      const creatorRaw= await contract.users(raw.creator);
      const imageURI  = raw.imageURI || '';
      const audioURI  = raw.audioURI || '';   // ✅ Đọc audioURI từ chain

      S.nfts[i] = {
        id:       i,
        name:     raw.name,
        desc:     raw.description,
        imageURI: imageURI,
        audioURI: audioURI,                   // ✅ Lưu vào state
        emoji:    imageURI.startsWith('http') ? '' : (imageURI.length <= 4 ? imageURI : '🎨'),
        creator:  raw.creator.toLowerCase(),
        owner:    raw.currentOwner.toLowerCase(),
        price:    formatEthPrice(raw.price),
        status:   ['Minted','ForSale','Sold'][Number(raw.status)] || 'Minted',
        mintedAt: Number(raw.mintedAt) * 1000
      };

      // Cache ảnh
      if (imageURI.startsWith('http')) {
        nftImageData[i] = imageURI;
      }

      // ✅ Cache audio từ IPFS — bền vững qua reload vì lấy từ chain
      if (audioURI.startsWith('http')) {
        const fileName = decodeURIComponent(audioURI.split('/').pop()) || 'audio.mp3';
        // Chỉ set nếu chưa có (tránh ghi đè audioAccess do user chỉnh)
        if (!S.nfts[i].audioCache) {
          S.nfts[i].audioCache = { url: audioURI, name: fileName };
        }
        if (audioAccess[i] === undefined) {
          audioAccess[i] = 'private'; // mặc định private
        }
      }

      if (!S.users[raw.creator.toLowerCase()]) {
        S.users[raw.creator.toLowerCase()] = {
          username:    creatorRaw.username || shortA(raw.creator),
          role:        ['None','Buyer','Seller','Both'][Number(creatorRaw.role)],
          registeredAt:Number(creatorRaw.registeredAt) * 1000
        };
      }
      if (!S.users[raw.currentOwner.toLowerCase()]) {
        S.users[raw.currentOwner.toLowerCase()] = {
          username:    ownerRaw.username || shortA(raw.currentOwner),
          role:        ['None','Buyer','Seller','Both'][Number(ownerRaw.role)],
          registeredAt:Number(ownerRaw.registeredAt) * 1000
        };
      }
    } catch(e) { console.warn(`Lỗi load NFT #${i}:`, e); }
  }
}

async function loadTransactions() {
  const total = Number(await contract.getTotalTransactions());
  S.txId = total;
  S.txs  = [];
  for (let i = 1; i <= total; i++) {
    try {
      const tx = await contract.transactions(i);
      S.txs.push({
        txId:      Number(tx.txId),
        tokenId:   Number(tx.tokenId),
        seller:    tx.seller.toLowerCase(),
        buyer:     tx.buyer.toLowerCase(),
        price:     formatEthPrice(tx.price),
        timestamp: Number(tx.timestamp) * 1000
      });
    } catch(e) { console.warn(`Lỗi load TX #${i}:`, e); }
  }
}

async function loadCurrentUser() {
  if (!account || !contract) return;
  try {
    const u = await contract.getUser(account);
    if (u.isRegistered) {
      S.users[account] = {
        username:     u.username,
        role:         ['None','Buyer','Seller','Both'][Number(u.role)],
        registeredAt: Number(u.registeredAt) * 1000
      };
    }
  } catch(e) { console.warn('Lỗi load user:', e); }
}

function formatEthPrice(weiVal) {
  try { return parseFloat(getEthers().formatEther(weiVal)); } catch { return 0; }
}
function parseEthToWei(ethVal) { return getEthers().parseEther(String(ethVal)); }

/* ════════════════════════════════
   CHỌN ẢNH / AUDIO
════════════════════════════════ */
function onNFTImageFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  nftImageFile = f;
  nftImageTemp = URL.createObjectURL(f);
  document.getElementById('mint-img-preview').innerHTML = `
    <img src="${nftImageTemp}" alt="preview"/>
    <div class="img-overlay">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      <span>Đổi ảnh</span>
    </div>`;
}

function onAudioFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const isVideo = f.type.startsWith('video/');
  document.getElementById('audio-fname').textContent = (isVideo ? '🎬 ' : '🎵 ') + f.name;
  const url = URL.createObjectURL(f);
  audioDataTemp = { url, name: f.name, _file: f };
  const container = document.getElementById('preview-container');
  document.getElementById('track-preview').style.display = 'flex';
  container.innerHTML = isVideo
    ? `<video id="preview-audio" controls style="width:100%;max-height:200px;border-radius:8px;"></video>`
    : `<audio id="preview-audio" controls style="width:100%;height:32px;"></audio>`;
  document.getElementById('preview-audio').src = url;
}

/* ════════════════════════════════
   TX MODAL
════════════════════════════════ */
function showTxModal(icon, title, sub) {
  document.getElementById('tx-icon').textContent = icon;
  document.getElementById('tx-title').textContent = title;
  document.getElementById('tx-sub').textContent = sub;
  document.getElementById('tx-detail').style.display = 'none';
  document.getElementById('tx-close-btn').style.display = 'none';
  document.getElementById('modal-tx').classList.add('open');
}
function showTxSuccess(detail = '') {
  document.getElementById('tx-icon').textContent = '✅';
  document.getElementById('tx-title').textContent = 'Giao dịch thành công!';
  document.getElementById('tx-sub').textContent = 'Đã xác nhận trên blockchain';
  if (detail) { const d = document.getElementById('tx-detail'); d.style.display = 'block'; d.innerHTML = detail; }
  document.getElementById('tx-close-btn').style.display = 'block';
}
function showTxError(msg) {
  document.getElementById('tx-icon').textContent = '❌';
  document.getElementById('tx-title').textContent = 'Giao dịch thất bại';
  document.getElementById('tx-sub').textContent = msg;
  document.getElementById('tx-close-btn').style.display = 'block';
}
function showLoadingOverlay(show) {
  const s = document.getElementById('s-total');
  if (s) s.textContent = show ? '…' : S.nftId;
}

/* ════════════════════════════════
   REGISTER
════════════════════════════════ */
async function handleRegister() {
  hide('reg-ok'); hide('reg-err');
  if (!account)  return showA('reg-err', '❌ Chưa kết nối MetaMask!');
  if (!contract) return showA('reg-err', '❌ Contract chưa khởi tạo!');
  const name    = document.getElementById('reg-name').value.trim();
  const roleStr = document.querySelector('input[name="r-role"]:checked')?.value;
  if (!name) return showA('reg-err', '❌ Nhập tên người dùng!');
  const roleMap = { 'Buyer': 1, 'Seller': 2, 'Both': 3 };
  const roleNum = roleMap[roleStr] || 3;
  closeModal('modal-register');
  showTxModal('🦊', 'Đăng ký tài khoản', 'Xác nhận trên MetaMask...');
  try {
    const tx = await contract.register(name, roleNum);
    showTxModal('⏳', 'Đang xử lý...', `TX: ${tx.hash.slice(0,10)}…`);
    await tx.wait();
    S.users[account] = { username: name, role: roleStr, registeredAt: Date.now() };
    showTxSuccess(`<div style="color:#b3b3b3;font-size:12px">Tên: <b style="color:#fff">${name}</b> · Vai trò: <b style="color:var(--green)">${roleStr}</b></div>`);
    showToast('✅ Đăng ký thành công!');
    renderAll(); updateSidebarNFTs();
  } catch(e) { const msg = parseContractError(e); showTxError(msg); showToast('❌ ' + msg); }
}

/* ════════════════════════════════
   MINT + IPFS  ✅ Upload audio lên IPFS + lưu on-chain
════════════════════════════════ */
async function handleMint() {
  hide('mint-err'); hide('mint-info');
  if (!account)  return showA('mint-err', '❌ Chưa kết nối MetaMask!');
  if (!contract) return showA('mint-err', '❌ Contract chưa khởi tạo!');
  const cu = S.users[account];
  if (!cu) return showA('mint-err', '❌ Chưa đăng ký hồ sơ!');
  if (cu.role === 'Buyer') return showA('mint-err', '❌ Cần vai trò Seller hoặc Both!');
  if (!nftImageFile && !nftImageTemp) return showA('mint-err', '❌ Vui lòng chọn ảnh đại diện!');

  const name     = document.getElementById('mint-name').value.trim();
  if (!name) return showA('mint-err', '❌ Nhập tên NFT!');
  const priceEth = parseFloat(document.getElementById('mint-price').value) || 0;
  const desc     = document.getElementById('mint-desc').value.trim();

  closeModal('modal-mint');
  showTxModal('📤', 'Upload ảnh lên IPFS...', 'Đang tải ảnh lên Pinata...');

  try {
    document.getElementById('mint-btn').disabled = true;

    // 1. Upload ảnh lên IPFS
    let imageIPFSUrl = nftImageTemp || '';
    if (nftImageFile) {
      imageIPFSUrl = await uploadToIPFS(nftImageFile);
    }

    // 2. ✅ Upload audio lên IPFS (nếu có)
    let audioIPFSUrl = '';
    if (audioDataTemp?._file) {
      showTxModal('📤', 'Upload nhạc lên IPFS...', 'Đang tải nhạc lên Pinata...');
      audioIPFSUrl = await uploadToIPFS(audioDataTemp._file);
      console.log('✅ Audio IPFS URL:', audioIPFSUrl);
    }

    // 3. Upload metadata JSON lên IPFS
    showTxModal('📤', 'Upload metadata...', 'Đang lưu metadata lên IPFS...');
    const metadata = {
      name,
      description: desc,
      image: imageIPFSUrl,
      ...(audioIPFSUrl && { animation_url: audioIPFSUrl }),
      attributes: [
        { trait_type: 'Creator',   value: cu.username },
        { trait_type: 'Minted At', value: new Date().toISOString() },
        ...(audioIPFSUrl ? [{ trait_type: 'Has Audio', value: 'Yes' }] : [])
      ]
    };
    await uploadMetadataToIPFS(metadata);

    // 4. ✅ Mint lên chain — truyền CẢ imageIPFSUrl lẫn audioIPFSUrl
    showTxModal('🦊', 'Mint NFT', 'Xác nhận trên MetaMask...');
    const mintTx = await contract.mintNFT(
      name,
      desc,
      imageIPFSUrl,
      audioIPFSUrl    // ✅ Lưu vĩnh viễn lên blockchain
    );
    showTxModal('⏳', 'Đang mint...', `TX: ${mintTx.hash.slice(0,10)}…`);
    const receipt = await mintTx.wait();

    // Lấy tokenId từ event NFTMinted
    let newTokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === 'NFTMinted') { newTokenId = Number(parsed.args.tokenId); break; }
      } catch {}
    }
    if (!newTokenId) newTokenId = Number(await contract.nftCounter());

    // 5. Cache local
    nftImageData[newTokenId] = imageIPFSUrl;
    nftImageFile = null; nftImageTemp = null;

    // ✅ audioAccess mặc định private (chủ có thể toggle sau)
    if (audioIPFSUrl) {
      audioAccess[newTokenId] = 'private';
    }
    audioDataTemp = null;

    // 6. Đăng bán nếu có giá
    if (priceEth > 0) {
      showTxModal('⏳', 'Đăng bán...', 'Xác nhận lần 2...');
      const listTx = await contract.listNFT(newTokenId, parseEthToWei(priceEth));
      await listTx.wait();
    }

    await loadNFTs();
    showTxSuccess(`
      <div style="color:#b3b3b3;font-size:12px">
        NFT <b style="color:#fff">#${newTokenId} "${name}"</b> đã mint thành công!<br>
        🖼️ <a href="${imageIPFSUrl}" target="_blank" style="color:var(--green)">Xem ảnh IPFS</a>
        ${audioIPFSUrl ? `<br>🎵 <a href="${audioIPFSUrl}" target="_blank" style="color:var(--green)">Xem audio IPFS</a>` : ''}
        ${priceEth > 0 ? `<br>💰 Giá: <b style="color:var(--green)">${priceEth} ETH</b>` : ''}
      </div>`);
    showToast(`✅ Mint thành công! NFT #${newTokenId}${audioIPFSUrl ? ' 🎵' : ''} 🌐`);

    // Reset form
    document.getElementById('mint-name').value  = '';
    document.getElementById('mint-desc').value  = '';
    document.getElementById('mint-price').value = '';
    document.getElementById('audio-fname').textContent = '';
    document.getElementById('track-preview').style.display = 'none';
    document.getElementById('mint-img-preview').innerHTML = `
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="color:#555">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
      <span style="font-size:12px;color:#666;margin-top:6px">Click để chọn ảnh</span>`;
    document.getElementById('mint-img-file').value = '';
    renderAll(); updateSidebarNFTs();

  } catch(e) {
    const msg = e.message?.includes('Pinata') ? e.message : parseContractError(e);
    showTxError(msg); showToast('❌ ' + msg);
  } finally { document.getElementById('mint-btn').disabled = false; }
}

/* ════════════════════════════════
   NFT DETAIL MODAL  ✅ Dùng audioURI từ S.nfts[id]
════════════════════════════════ */
function openNFT(id) {
  currentNFTId = id;
  const nft    = S.nfts[id];
  const cu     = account ? S.users[account] : null;
  const isOwner = nft.owner === account;
  const isAdmin = account && account.toLowerCase() === adminAddress;
  const canSell = cu && (cu.role === 'Seller' || cu.role === 'Both');
  const canBuy  = cu && (cu.role === 'Buyer'  || cu.role === 'Both');
  const ownerU  = S.users[nft.owner]?.username   || shortA(nft.owner);
  const creatU  = S.users[nft.creator]?.username || shortA(nft.creator);
  const colors  = ['#1a0036','#001a2e','#0d1a00','#1a0a00','#001a1a','#1a1a2e'];
  const bg      = colors[id % colors.length];

  // ✅ Lấy audio từ S.nfts[id].audioURI (on-chain) thay vì audioData{}
  const audioURI  = nft.audioURI || '';
  const hasAudio  = audioURI.startsWith('http');
  const access    = audioAccess[id] || 'private';
  const hasImage  = !!nftImageData[id];

  const thumbHTML = hasImage
    ? `<div class="nft-detail-img" style="background:${bg};padding:0;overflow:hidden">
        <img src="${nftImageData[id]}" style="width:100%;height:100%;object-fit:cover" alt="${nft.name}"/>
       </div>`
    : `<div class="nft-detail-img" style="background:${bg}">${nft.emoji || '🎨'}</div>`;

  // Admin panel: xóa ảnh
  let imageAdminPanel = '';
  if (isAdmin && hasImage) {
    imageAdminPanel = `
      <div style="margin-bottom:10px;padding:8px 12px;background:#2a1010;border:1px solid #c0392b;border-radius:8px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;color:#fca5a5">🛡️ Admin: quản lý ảnh NFT #${id}</span>
        <button onclick="adminDeleteNFTMedia(${id},'image')" style="background:#c0392b;border:none;color:#fff;border-radius:8px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer">🗑️ Xóa ảnh</button>
      </div>`;
  }

  // Panel audio
  let audioPanel = '';
  if (!hasAudio) {
    audioPanel = `<div style="background:#1e1e1e;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:var(--muted)">🎵 Không có file nhạc đính kèm</div>`;
  } else if (isOwner) {
    audioPanel = `
    <div style="background:#1e1e1e;border-radius:6px;padding:12px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="font-size:18px">🎵</span>
        <div style="flex:1">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${decodeURIComponent(audioURI.split('/').pop())}</div>
          <button onclick="playNFTAudio(${id})" style="background:var(--green);border:none;color:#000;border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700;cursor:pointer">▶ Phát</button>
        </div>
        <span style="font-size:10px;background:${access==='public'?'rgba(29,185,84,.2)':'rgba(255,255,255,.08)'};color:${access==='public'?'var(--green)':'var(--muted)'};padding:3px 8px;border-radius:10px;font-weight:700">${access==='public'?'🌍 Công khai':'🔒 Riêng tư'}</span>
      </div>
      <div style="border-top:1px solid #333;padding-top:10px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Quyền nghe nhạc:</div>
        <div style="display:flex;gap:6px">
          <button onclick="setAudioAccess(${id},'private')" style="flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ${access==='private'?'var(--green)':'#444'};background:${access==='private'?'rgba(29,185,84,.15)':'transparent'};color:${access==='private'?'var(--green)':'var(--muted)'}">🔒 Chỉ mình tôi</button>
          <button onclick="setAudioAccess(${id},'public')"  style="flex:1;padding:6px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ${access==='public'?'var(--green)':'#444'};background:${access==='public'?'rgba(29,185,84,.15)':'transparent'};color:${access==='public'?'var(--green)':'var(--muted)'}">🌍 Mọi người</button>
        </div>
      </div>
    </div>`;
  } else if (access === 'public') {
    audioPanel = `
    <div style="background:#1e1e1e;border-radius:6px;padding:10px 12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:18px">🎵</span>
      <div style="flex:1">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Audio NFT công khai</div>
        <button onclick="playNFTAudio(${id})" style="background:var(--green);border:none;color:#000;border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700;cursor:pointer">▶ Phát</button>
      </div>
      <span style="font-size:10px;color:var(--green);background:rgba(29,185,84,.1);padding:3px 8px;border-radius:10px">🌍 Công khai</span>
    </div>`;
  } else {
    audioPanel = `
    <div style="background:#1e1e1e;border-radius:6px;padding:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:20px">🔒</span>
      <div>
        <div style="font-size:12px;color:#fff;font-weight:700">Nhạc được bảo vệ</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Chỉ chủ sở hữu mới nghe được</div>
      </div>
    </div>`;
  }

  // Admin panel: xóa audio
  let audioAdminPanel = '';
  if (isAdmin && hasAudio) {
    audioAdminPanel = `
      <div style="margin-bottom:10px;padding:8px 12px;background:#2a1010;border:1px solid #c0392b;border-radius:8px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:11px;color:#fca5a5">🛡️ Admin: quản lý nhạc NFT #${id}</span>
        <button onclick="adminDeleteNFTMedia(${id},'audio')" style="background:#c0392b;border:none;color:#fff;border-radius:8px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer">🗑️ Xóa nhạc</button>
      </div>`;
  }

  // Nút actions
  let actions = '';
  if (!cu) {
    actions = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:10px">👤 Đăng ký hồ sơ để tương tác</div>`;
  } else if (isOwner && nft.status === 'Minted' && canSell) {
    actions = `<div style="display:flex;gap:8px;margin-top:4px">
      <input id="list-price" type="number" min="0.001" step="0.001" placeholder="Giá ETH" class="form-inp" style="flex:1"/>
      <button onclick="handleList(${id})" style="background:var(--green);border:none;color:#000;border-radius:20px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">📋 Đăng bán</button>
    </div>`;
  } else if (isOwner && nft.status === 'ForSale') {
    actions = `<button onclick="handleDelist(${id})" style="width:100%;background:#c0392b;border:none;color:#fff;border-radius:20px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">❌ Hủy đăng bán</button>`;
  } else if (!isOwner && nft.status === 'ForSale' && canBuy) {
    actions = `<button onclick="handleBuy(${id})" style="width:100%;background:var(--green);border:none;color:#000;border-radius:20px;padding:12px;font-size:14px;font-weight:700;cursor:pointer">🛒 Mua ngay — ${nft.price} ETH</button>`;
  } else if (!isOwner && nft.status === 'ForSale' && !canBuy) {
    actions = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:10px">Cần vai trò Buyer hoặc Both để mua</div>`;
  } else if (nft.status === 'Sold') {
    actions = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:10px">NFT này đã được bán</div>`;
  }

  document.getElementById('nft-modal-body').innerHTML = `
    ${thumbHTML}
    <h3 style="font-size:18px;font-weight:700;margin-bottom:4px">${nft.name} <span style="color:var(--muted);font-weight:400">#${id}</span></h3>
    ${nft.desc ? `<p style="color:var(--muted);font-size:12px;margin-bottom:12px">${nft.desc}</p>` : ''}
    <div class="meta-row">
      <div class="meta-box"><div class="lbl">Creator</div><div class="val">${creatU}</div></div>
      <div class="meta-box"><div class="lbl">Owner</div><div class="val">${ownerU}</div></div>
      ${nft.status==='ForSale'?`<div class="meta-box"><div class="lbl">Giá</div><div class="val" style="color:var(--green)">${nft.price} ETH</div></div>`:''}
      <div class="meta-box"><div class="lbl">Trạng thái</div><div class="val">${nft.status}</div></div>
    </div>
    ${imageAdminPanel}
    ${audioAdminPanel}
    ${audioPanel}
    <div id="nft-actions">${actions}</div>
    <div class="alert" id="nft-msg" style="margin-top:10px"></div>`;
  openModal('modal-nft');
}

/* ════════════════════════════════
   ADMIN XÓA MEDIA  ✅ Gọi adminDeleteMedia on-chain
════════════════════════════════ */
async function adminDeleteNFTMedia(id, mediaType) {
  if (!account || account.toLowerCase() !== adminAddress) return showToast('❌ Chỉ admin!');
  const label = mediaType === 'image' ? 'ảnh' : 'nhạc';
  if (!confirm(`⚠️ Xóa ${label} NFT #${id} trên blockchain?`)) return;

  closeModal('modal-nft');
  showTxModal('🦊', `Admin xóa ${label}`, 'Xác nhận trên MetaMask...');
  try {
    const tx = await contract.adminDeleteMedia(id, mediaType);
    showTxModal('⏳', 'Đang xử lý...', `TX: ${tx.hash.slice(0,10)}…`);
    await tx.wait();

    // Xóa cache local
    if (mediaType === 'image') delete nftImageData[id];
    // audioURI sẽ tự "" khi loadNFTs() reload

    showTxSuccess(`<div style="color:#fca5a5;font-size:12px">Đã xóa ${label} NFT #${id} trên blockchain</div>`);
    showToast(`🗑️ Đã xóa ${label} NFT #${id}`);
    await loadNFTs();
    renderAll();
  } catch(e) { const msg = parseContractError(e); showTxError(msg); showToast('❌ ' + msg); }
}

function setAudioAccess(id, mode) {
  if (!S.nfts[id] || S.nfts[id].owner !== account) return showToast('❌ Chỉ chủ sở hữu!');
  if (!S.nfts[id].audioURI) return showToast('❌ Không có nhạc!');
  audioAccess[id] = mode;
  showToast(mode === 'public' ? '🌍 Đã chia sẻ công khai' : '🔒 Đã đặt riêng tư');
  openNFT(id);
}

/* ════════════════════════════════
   LIST / DELIST / BUY
════════════════════════════════ */
async function handleList(id) {
  const priceEth = parseFloat(document.getElementById('list-price').value);
  if (!priceEth || priceEth <= 0) return showA('nft-msg', '❌ Nhập giá hợp lệ!', 'err');
  closeModal('modal-nft');
  showTxModal('🦊', 'Đăng bán NFT', 'Xác nhận trên MetaMask...');
  try {
    const tx = await contract.listNFT(id, parseEthToWei(priceEth));
    showTxModal('⏳', 'Đang xử lý...', `TX: ${tx.hash.slice(0,10)}…`);
    await tx.wait();
    S.nfts[id].price = priceEth; S.nfts[id].status = 'ForSale';
    showTxSuccess(`<div style="color:#b3b3b3;font-size:12px">NFT <b>#${id}</b> đang bán: <b style="color:var(--green)">${priceEth} ETH</b></div>`);
    showToast(`✅ Đã đăng bán NFT #${id}`); renderAll();
  } catch(e) { const msg = parseContractError(e); showTxError(msg); showToast('❌ ' + msg); }
}

async function handleDelist(id) {
  closeModal('modal-nft');
  showTxModal('🦊', 'Hủy đăng bán', 'Xác nhận trên MetaMask...');
  try {
    const tx = await contract.delistNFT(id);
    showTxModal('⏳', 'Đang xử lý...', `TX: ${tx.hash.slice(0,10)}…`);
    await tx.wait();
    S.nfts[id].status = 'Minted'; S.nfts[id].price = 0;
    showTxSuccess(`<div style="color:#b3b3b3;font-size:12px">NFT <b>#${id}</b> đã hủy đăng bán</div>`);
    showToast(`✅ Hủy đăng bán NFT #${id}`); renderAll();
  } catch(e) { const msg = parseContractError(e); showTxError(msg); showToast('❌ ' + msg); }
}

async function handleBuy(id) {
  if (!account) return;
  const nft = S.nfts[id];
  closeModal('modal-nft');
  showTxModal('🦊', 'Mua NFT', 'Xác nhận trên MetaMask...');
  try {
    const raw = await contract.nfts(id);
    if (Number(raw.status) !== 1) { showTxError('NFT không còn đang bán!'); await loadNFTs(); renderAll(); return; }
    if (raw.currentOwner.toLowerCase() === account) { showTxError('Bạn đã là chủ sở hữu NFT này!'); return; }

    const tx = await contract.buyNFT(id);
    showTxModal('⏳', 'Đang xử lý...', `TX: ${tx.hash.slice(0,10)}…`);
    await tx.wait();

    const seller = nft.owner;
    S.txId++;
    S.txs.push({ txId: S.txId, tokenId: id, seller, buyer: account, price: nft.price, timestamp: Date.now() });
    S.nfts[id].owner  = account;
    S.nfts[id].status = 'Sold';
    S.nfts[id].price  = 0;
    // audioAccess theo owner mới, mặc định private
    if (S.nfts[id].audioURI) audioAccess[id] = 'private';

    showTxSuccess(`<div style="color:#b3b3b3;font-size:12px">NFT <b>#${id} "${nft.name}"</b> là của bạn!${S.nfts[id].audioURI ? '<br>🎵 Nhạc đã chuyển sang bạn' : ''}</div>`);
    showToast(`🎉 Mua thành công! NFT #${id}`);
    renderAll(); updateSidebarNFTs();
  } catch(e) {
    const msg = parseContractError(e);
    showTxError(msg); showToast('❌ ' + msg);
    await loadNFTs(); renderAll();
  }
}

/* ════════════════════════════════
   DELETE ACCOUNT
════════════════════════════════ */
async function handleDeleteMyAccount() {
  if (!account || !contract) return showToast('❌ Chưa kết nối!');
  if (!S.users[account]) return showToast('❌ Chưa đăng ký!');
  if (!confirm(`⚠️ Xóa tài khoản "${S.users[account].username}"?`)) return;
  closeModal('modal-register');
  showTxModal('🦊', 'Xóa tài khoản', 'Xác nhận trên MetaMask...');
  try {
    const tx = await contract.deleteMyaccount();
    showTxModal('⏳', 'Đang xử lý...', `TX: ${tx.hash.slice(0,10)}…`);
    await tx.wait();
    delete S.users[account];
    showTxSuccess('<div style="color:#fca5a5;font-size:12px">Tài khoản đã bị xóa</div>');
    showToast('🗑️ Đã xóa tài khoản'); renderAll(); updateSidebarNFTs();
  } catch(e) { const msg = parseContractError(e); showTxError(msg); showToast('❌ ' + msg); }
}

async function adminDeleteAccount(addr) {
  if (!account || !contract) return;
  const target = S.users[addr];
  if (!target) return showToast('❌ Không tồn tại!');
  if (account.toLowerCase() !== adminAddress) return showToast('❌ Chỉ admin!');
  if (!confirm(`⚠️ [ADMIN] Xóa "${target.username}"?`)) return;
  showTxModal('🦊', 'Admin xóa tài khoản', 'Xác nhận...');
  try {
    const tx = await contract.adminDeleteAccount(addr);
    showTxModal('⏳', 'Đang xử lý...', `TX: ${tx.hash.slice(0,10)}…`);
    await tx.wait();
    delete S.users[addr];
    showTxSuccess(`<div style="color:#fca5a5;font-size:12px">Đã xóa: <b>${target.username}</b></div>`);
    showToast(`🗑️ Đã xóa: ${target.username}`); renderAll();
  } catch(e) { const msg = parseContractError(e); showTxError(msg); showToast('❌ ' + msg); }
}

/* ════════════════════════════════
   PARSE ERROR
════════════════════════════════ */
function parseContractError(e) {
  if (e.reason) return e.reason;
  if (e.data?.message) return e.data.message;
  if (e.message) {
    const m1 = e.message.match(/reason="([^"]+)"/);    if (m1) return m1[1];
    const m2 = e.message.match(/reverted with reason string '([^']+)'/); if (m2) return m2[1];
    if (e.message.includes('user rejected') || e.message.includes('User denied')) return 'Người dùng từ chối';
    return e.message.slice(0, 100);
  }
  return 'Giao dịch thất bại';
}

/* ════════════════════════════════
   AUDIO PLAYER  ✅ Dùng audioURI từ S.nfts[id]
════════════════════════════════ */
function playNFTAudio(id) {
  const nft     = S.nfts[id];
  const audioURI = nft.audioURI || '';
  if (!audioURI) { showToast('❌ Không có file nhạc'); return; }

  const isOwner = nft.owner === account;
  const access  = audioAccess[id] || 'private';
  if (!isOwner && access !== 'public') { showToast('🔒 Nhạc được bảo vệ'); return; }

  closeModal('modal-nft');
  audioEl.src = audioURI;
  audioEl.play();
  isPlaying = true;

  // Update now-playing bar
  const thumbEl = document.getElementById('nb-thumb');
  if (nftImageData[id]) {
    thumbEl.style.backgroundImage = `url(${nftImageData[id]})`;
    thumbEl.style.backgroundSize = 'cover';
    thumbEl.style.backgroundPosition = 'center';
    thumbEl.textContent = '';
  } else {
    thumbEl.style.backgroundImage = '';
    thumbEl.textContent = nft.emoji || '🎵';
  }
  document.getElementById('nb-name').textContent   = nft.name;
  document.getElementById('nb-artist').textContent = S.users[nft.creator]?.username || shortA(nft.creator);
  updatePlayBtn();

  // Build queue: tất cả NFT có audio mà user được phép nghe
  playQueue = Object.values(S.nfts).filter(n => {
    if (!n.audioURI) return false;
    return n.owner === account || (audioAccess[n.id] || 'private') === 'public';
  }).map(n => n.id);
  playIdx = playQueue.indexOf(id);

  showToast('▶ ' + nft.name);
}

// Alias cũ để tương thích với HTML nếu dùng playNFT
function playNFT(id) { playNFTAudio(id); }

function togglePlay() {
  if (!audioEl.src) { showToast('Chọn NFT có nhạc'); return; }
  isPlaying ? (audioEl.pause(), isPlaying=false) : (audioEl.play(), isPlaying=true);
  updatePlayBtn();
}
function updatePlayBtn() {
  document.getElementById('nb-play-ico').innerHTML = isPlaying
    ? '<path d="M5.7 3a1 1 0 0 0-1 1v16a1 1 0 0 0 2 0V4a1 1 0 0 0-1-1zm12.6 0a1 1 0 0 0-1 1v16a1 1 0 0 0 2 0V4a1 1 0 0 0-1-1z"/>'
    : '<path d="M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/>';
}
function updateProgress() {
  const d = audioEl.duration||0, c = audioEl.currentTime||0;
  document.getElementById('nb-prog').style.width = d?(c/d*100)+'%':'0%';
  document.getElementById('nb-cur').textContent = fmtTime(c);
  document.getElementById('nb-dur').textContent = fmtTime(d);
}
function seekTrack(e) {
  if (!audioEl.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  audioEl.currentTime = ((e.clientX-r.left)/r.width)*audioEl.duration;
}
function prevTrack() { if(!playQueue.length)return; playIdx=(playIdx-1+playQueue.length)%playQueue.length; playNFTAudio(playQueue[playIdx]); }
function nextTrack() { if(!playQueue.length)return; playIdx=(playIdx+1)%playQueue.length; playNFTAudio(playQueue[playIdx]); }
function toggleMute() { audioEl.muted=!audioEl.muted; }
function setVol(e) {
  const r=e.currentTarget.getBoundingClientRect();
  const v=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
  audioEl.volume=v; document.getElementById('vol-fill').style.width=(v*100)+'%';
}
let hearted=false;
function toggleHeart() {
  hearted=!hearted;
  document.getElementById('nb-heart').textContent=hearted?'♥':'♡';
  document.getElementById('nb-heart').style.color=hearted?'#1DB954':'var(--muted)';
}
function fmtTime(s) {
  if(!s||isNaN(s))return'0:00';
  return Math.floor(s/60)+':'+(Math.floor(s%60)<10?'0':'')+Math.floor(s%60);
}

/* ════════════════════════════════
   RENDER
════════════════════════════════ */
const CARD_COLORS=['#1a0036','#001a2e','#0d1a00','#1a0a00','#001a1a','#1a1a2e','#1a1500','#001a12'];

function renderAll() {
  updateStats(); renderNFTGrid(); renderArtistGrid();
  if(currentPage==='my-nfts') renderMyNFTs();
  if(currentPage==='history') renderHistory();
  if(currentPage==='users')   renderUsers();
}
function updateStats() {
  const all=Object.values(S.nfts);
  document.getElementById('s-total').textContent=all.length;
  document.getElementById('s-listed').textContent=all.filter(n=>n.status==='ForSale').length;
  document.getElementById('s-tx').textContent=S.txs.length;
}
function renderNFTGrid() {
  const q=document.getElementById('search-inp').value.toLowerCase();
  const all=Object.values(S.nfts).filter(n=>{
    if(currentFilter!=='all'&&n.status!==currentFilter)return false;
    if(q&&!n.name.toLowerCase().includes(q))return false;
    return true;
  });
  const g=document.getElementById('nft-grid');
  if(!all.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div>🎨</div><div>Chưa có NFT nào</div></div>`;return;}
  g.innerHTML=all.map(nft=>cardHTML(nft)).join('');
}
function cardHTML(nft) {
  const bg=CARD_COLORS[nft.id%CARD_COLORS.length];
  const isMine=nft.owner===account;
  // ✅ Dùng audioURI từ on-chain
  const hasAudio = !!(nft.audioURI && nft.audioURI.startsWith('http'));
  const hasImg=!!nftImageData[nft.id];
  const access=audioAccess[nft.id]||'private';
  const canPlay=hasAudio&&(isMine||access==='public');
  const badge=nft.status==='ForSale'?`<span class="badge b-sale">Đang bán</span>`:nft.status==='Sold'?`<span class="badge b-sold">Đã bán</span>`:`<span class="badge b-minted">Minted</span>`;
  const thumbInner=hasImg?`<img src="${nftImageData[nft.id]}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit" alt="${nft.name}"/>`:nft.emoji||'🎨';
  return `<div class="card" onclick="openNFT(${nft.id})" style="${isMine?'outline:2px solid rgba(29,185,84,.4)':''}">
    <div class="card-thumb" style="background:${bg};position:relative">
      ${thumbInner}
      ${hasAudio?`<span style="position:absolute;top:6px;left:6px;font-size:12px;background:rgba(0,0,0,.7);border-radius:10px;padding:2px 7px;font-weight:700;color:${access==='public'?'var(--green)':'#fcd34d'};z-index:2">${access==='public'?'♪':'🔒'}</span>`:''}
      ${isMine?`<span style="position:absolute;top:6px;right:6px;font-size:10px;background:rgba(29,185,84,.85);border-radius:10px;padding:2px 7px;font-weight:700;color:#000;z-index:2">Của tôi</span>`:''}
      <button class="play-btn" style="z-index:3" onclick="event.stopPropagation();${canPlay?`playNFTAudio(${nft.id})`:`openNFT(${nft.id})`}">
        <svg viewBox="0 0 24 24"><path d="M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/></svg>
      </button>
    </div>
    <div class="card-name">${nft.name} <span style="color:var(--muted);font-weight:400;font-size:10px">#${nft.id}</span></div>
    <div class="card-sub">${S.users[nft.creator]?.username||shortA(nft.creator)}</div>
    ${badge}
    ${nft.status==='ForSale'?`<div class="card-price">${nft.price} ETH</div>`:''}
  </div>`;
}
function renderArtistGrid() {
  const artists={};
  Object.values(S.nfts).forEach(n=>{
    if(!artists[n.creator])artists[n.creator]={addr:n.creator,count:0,eth:0,nftId:n.id};
    artists[n.creator].count++;
    if(n.status==='Sold')artists[n.creator].eth+=n.price||0;
    artists[n.creator].nftId=n.id;
  });
  const g=document.getElementById('artist-grid');
  const list=Object.values(artists);
  if(!list.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div>🎤</div><div>Chưa có artist</div></div>`;return;}
  const colors=['#1a0036','#001a2e','#0d1a00','#1a0a00'];
  g.innerHTML=list.map((a,i)=>{
    const name=S.users[a.addr]?.username||shortA(a.addr);
    const nft=S.nfts[a.nftId];
    const hasImg=nft&&!!nftImageData[nft.id];
    const thumbInner=hasImg?`<img src="${nftImageData[nft.id]}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit" alt=""/>`:nft?.emoji||'🎨';
    return `<div class="card" onclick="showToast('Artist: ${name}')">
      <div class="card-thumb circle" style="background:${colors[i%colors.length]};position:relative">${thumbInner}
        <button class="play-btn" style="z-index:3"><svg viewBox="0 0 24 24"><path d="M7.05 3.606l13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z"/></svg></button>
      </div>
      <div class="card-name">${name}</div>
      <div class="card-sub">${a.count} NFTs · ${a.eth.toFixed(2)} ETH</div>
    </div>`;
  }).join('');
}
function renderMyNFTs() {
  if(!account){document.getElementById('my-nft-grid').innerHTML=`<div class="empty" style="grid-column:1/-1"><div>🦊</div><div>Kết nối ví</div></div>`;return;}
  const mine=Object.values(S.nfts).filter(n=>n.owner===account);
  const g=document.getElementById('my-nft-grid');
  if(!mine.length){g.innerHTML=`<div class="empty" style="grid-column:1/-1"><div>🎨</div><div>Chưa có NFT</div></div>`;return;}
  g.innerHTML=mine.map(nft=>cardHTML(nft)).join('');
}
function renderHistory() {
  const el=document.getElementById('tx-list');
  if(!S.txs.length){el.innerHTML=`<div class="empty"><div>📭</div><div>Chưa có giao dịch</div></div>`;return;}
  el.innerHTML=[...S.txs].reverse().map(tx=>{
    const nft=S.nfts[tx.tokenId];
    const seller=S.users[tx.seller]?.username||shortA(tx.seller);
    const buyer=S.users[tx.buyer]?.username||shortA(tx.buyer);
    const isMe=tx.buyer===account||tx.seller===account;
    const hasImg=nft&&!!nftImageData[nft.id];
    const thumb=hasImg?`<img src="${nftImageData[nft.id]}" style="width:100%;height:100%;object-fit:cover;border-radius:6px" alt=""/>`:nft?.emoji||'🎨';
    return `<div class="tx-row" style="${isMe?'outline:1px solid rgba(29,185,84,.3)':''}">
      <div class="tx-thumb" style="position:relative;overflow:hidden">${thumb}</div>
      <div class="tx-info" style="flex:1">
        <div class="tx-name">${nft?.name||'Unknown'} <span style="color:var(--muted);font-size:11px">#${tx.tokenId}</span></div>
        <div class="tx-meta">TX #${tx.txId} · <span style="color:#fca5a5">${seller}</span> → <span style="color:var(--green)">${buyer}</span></div>
        <div class="tx-meta">${new Date(tx.timestamp).toLocaleString('vi-VN')}</div>
      </div>
      <div class="tx-price">${tx.price} ETH</div>
    </div>`;
  }).join('');
}
function renderUsers() {
  const el=document.getElementById('user-list');
  const list=Object.entries(S.users);
  if(!list.length){el.innerHTML=`<div class="empty"><div>👥</div><div>Chưa có người dùng</div></div>`;return;}
  const uc=['#1a0036','#001a2e','#0d1a00','#1a0a00'];
  const isAdmin=account&&account.toLowerCase()===adminAddress;
  el.innerHTML=list.map(([addr,u],i)=>{
    const owned=Object.values(S.nfts).filter(n=>n.owner===addr).length;
    const isMe=addr===account;
    const roleColor=u.role==='Both'?'var(--green)':u.role==='Seller'?'#c084fc':'#93c5fd';
    return `<div class="user-row" style="${isMe?'outline:1px solid rgba(29,185,84,.35)':''}">
      <div class="user-av" style="background:${uc[i%uc.length]};font-size:18px">${u.username.charAt(0).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">${u.username}${isMe?` <span style="font-size:10px;background:rgba(29,185,84,.2);color:var(--green);padding:2px 7px;border-radius:10px;font-weight:700">bạn</span>`:''}</div>
        <div style="font-size:11px;color:var(--muted);font-family:monospace">${addr.slice(0,14)}…</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${owned} NFTs</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:700;color:${roleColor};background:rgba(255,255,255,.06);padding:3px 10px;border-radius:10px">${u.role}</span>
        ${isAdmin&&!isMe?`<button onclick="adminDeleteAccount('${addr}')" title="Xóa" style="background:transparent;border:1px solid #c0392b;color:#fca5a5;border-radius:8px;padding:3px 8px;font-size:11px;cursor:pointer">🗑️</button>`:''}
      </div>
    </div>`;
  }).join('');
}
function updateSidebarNFTs() {
  if(!account)return;
  const mine=Object.values(S.nfts).filter(n=>n.creator===account).slice(-5);
  const el=document.getElementById('sidebar-nft-list');
  el.innerHTML=mine.map(n=>{
    const hasImg=!!nftImageData[n.id];
    return `<div class="playlist-item" onclick="openNFT(${n.id})">
      <div class="playlist-thumb" style="position:relative;overflow:hidden">
        ${hasImg?`<img src="${nftImageData[n.id]}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;position:absolute;inset:0" alt=""/>`:n.emoji||'🎨'}
      </div>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${n.name}</div>
        <div style="font-size:11px;color:var(--muted)">NFT #${n.id}${n.audioURI?'  🎵':''}</div>
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════
   NAV / PAGES
════════════════════════════════ */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  const page=document.getElementById('page-'+id);
  if(page)page.style.display='block';
  document.querySelectorAll('.slink').forEach(s=>s.classList.remove('active'));
  currentPage=id;
  if(id==='marketplace'){document.querySelectorAll('.slink')[0].classList.add('active');renderNFTGrid();renderArtistGrid();}
  if(id==='my-nfts')    {document.querySelectorAll('.slink')[2].classList.add('active');renderMyNFTs();}
  if(id==='history')    {document.querySelectorAll('.slink')[3].classList.add('active');renderHistory();}
  if(id==='users')      {document.querySelectorAll('.slink')[4].classList.add('active');renderUsers();}
}
function setPill(el,f) {
  document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active'); currentFilter=f; renderNFTGrid();
}

/* ════════════════════════════════
   MODAL HELPERS
════════════════════════════════ */
function openModal(id) {
  if (id === 'modal-register') {
    // ✅ Tự điền địa chỉ ví vào ô input
    const regAddr = document.getElementById('reg-addr');
    if (regAddr && account) regAddr.value = account;

    const delBtn = document.getElementById('btn-delete-acc');
    if (delBtn) delBtn.style.display = (account && S.users[account]) ? 'block' : 'none';
  }
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

/* ════════════════════════════════
   TOAST / ALERT
════════════════════════════════ */
let toastTimer;
function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}
function showA(id,msg,type='ok') {
  const el=document.getElementById(id); if(!el)return;
  el.textContent=msg; el.className=`alert alert-${type} show`;
}
function hide(id){const el=document.getElementById(id);if(el)el.classList.remove('show');}
function shortA(a){return a?a.slice(0,6)+'…'+a.slice(-4):'—';}

// Init
renderAll();