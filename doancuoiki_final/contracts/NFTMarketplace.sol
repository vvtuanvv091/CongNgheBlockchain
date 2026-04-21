// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NFTMarketplace - Chợ NFT Mini (giống OpenSea bản fake)
 * @author tongngoctuan - Đại học Công Nghệ Đồng Nai
 * @notice Smart Contract quản lý marketplace NFT mô phỏng
 * @dev Dự án học tập - Blockchain Programming Course
 */

contract NFTMarketplace {

    // ========================================
    // PHẦN 1: ĐỊNH NGHĨA CẤU TRÚC DỮ LIỆU
    // ========================================

    /**
     * @dev Enum định nghĩa vai trò người dùng
     */
    enum Role {
        None,       // 0 - Chưa đăng ký
        Buyer,      // 1 - Người mua
        Seller,     // 2 - Người bán
        Both        // 3 - Cả hai
    }

    /**
     * @dev Enum trạng thái NFT trên marketplace
     */
    enum NFTStatus {
        Minted,     // 0 - Đã mint (chưa đăng bán)
        ForSale,    // 1 - Đang bán trên marketplace
        Sold        // 2 - Đã được mua
    }

    /**
     * @dev Struct lưu thông tin người dùng
     */
    struct User {
        address account;        // Địa chỉ ví
        string username;        // Tên người dùng
        Role role;              // Vai trò (Buyer / Seller / Both)
        bool isRegistered;      // Đã đăng ký chưa
        uint256 registeredAt;   // Thời điểm đăng ký
    }

    /**
     * @dev Struct lưu thông tin NFT
     */
    struct NFT {
        uint256 tokenId;            // Mã NFT duy nhất
        string name;                // Tên NFT
        string description;         // Mô tả
        string imageURI;            // Đường dẫn ảnh (IPFS hoặc URL)
        string audioURI;      // mp3
        address creator;            // Người tạo (mint) NFT
        address currentOwner;       // Chủ sở hữu hiện tại
        uint256 price;              // Giá bán (ETH giả lập - tính bằng Wei)
        NFTStatus status;           // Trạng thái hiện tại
        uint256 mintedAt;           // Thời điểm mint
    }

    /**
     * @dev Struct lưu lịch sử giao dịch
     */
    struct Transaction {
        uint256 txId;           // Mã giao dịch
        uint256 tokenId;        // NFT liên quan
        address seller;         // Người bán
        address buyer;          // Người mua
        uint256 price;          // Giá giao dịch
        uint256 timestamp;      // Thời điểm giao dịch
    }

    // ========================================
    // PHẦN 2: BIẾN TRẠNG THÁI
    // ========================================

    address public admin;
    uint256 public nftCounter = 0;          // Bộ đếm NFT (tokenId tự tăng)
    uint256 public txCounter = 0;           // Bộ đếm giao dịch

    mapping(address => User) public users;              // Thông tin người dùng
    mapping(uint256 => NFT) public nfts;                // Thông tin NFT
    mapping(uint256 => Transaction) public transactions; // Lịch sử giao dịch

    // Danh sách NFT đang bán (để lọc nhanh)
    uint256[] public listedTokenIds;

    // ========================================
    // PHẦN 3: EVENTS
    // ========================================

    event UserRegistered(
        address indexed account,
        string username,
        Role role,
        uint256 timestamp
    );

    event NFTMinted(
        uint256 indexed tokenId,
        string name,
        address indexed creator,
        uint256 timestamp
    );

    event NFTListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 timestamp
    );

    event NFTSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 timestamp
    );

    event NFTDelisted(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 timestamp
    );


    event AccountDeleted(
        address indexed account,
        address indexed deletedBy,
        uint256 timestamp
    );
    // ========================================
    // PHẦN 4: MODIFIERS
    // ========================================

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi admin moi duoc thuc hien");
        _;
    }

    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "Ban chua dang ky tai khoan");
        _;
    }

    modifier canSell() {
        require(users[msg.sender].isRegistered, "Ban chua dang ky tai khoan");
        require(
            users[msg.sender].role == Role.Seller ||
            users[msg.sender].role == Role.Both,
            "Ban khong co quyen ban NFT (can dang ky vai tro Seller)"
        );
        _;
    }

    modifier canBuy() {
        require(users[msg.sender].isRegistered, "Ban chua dang ky tai khoan");
        require(
            users[msg.sender].role == Role.Buyer ||
            users[msg.sender].role == Role.Both,
            "Ban khong co quyen mua NFT (can dang ky vai tro Buyer)"
        );
        _;
    }

    modifier nftExists(uint256 _tokenId) {
        require(_tokenId > 0 && _tokenId <= nftCounter, "NFT khong ton tai");
        _;
    }

    modifier onlyNFTOwner(uint256 _tokenId) {
        require(nfts[_tokenId].currentOwner == msg.sender, "Ban khong phai chu NFT nay");
        _;
    }

    // ========================================
    // PHẦN 5: CONSTRUCTOR
    // ========================================

    constructor() {
        admin = msg.sender;

        // Admin tự động đăng ký với quyền Both
        users[admin] = User({
            account: admin,
            username: "Marketplace Admin",
            role: Role.Both,
            isRegistered: true,
            registeredAt: block.timestamp
        });

        emit UserRegistered(admin, "Marketplace Admin", Role.Both, block.timestamp);
    }

    // ========================================
    // PHẦN 6: ĐĂNG KÝ NGƯỜI DÙNG
    // ========================================

    /**
     * @dev Người dùng tự đăng ký tài khoản
     * @param _username Tên hiển thị
     * @param _role Vai trò: 1 = Buyer, 2 = Seller, 3 = Both
     */
    function register(string memory _username, Role _role) public {
        require(!users[msg.sender].isRegistered, "Ban da dang ky roi");
        require(
            _role == Role.Buyer || _role == Role.Seller || _role == Role.Both,
            "Vai tro khong hop le (1=Buyer, 2=Seller, 3=Both)"
        );
        require(bytes(_username).length > 0, "Ten nguoi dung khong duoc trong");

        users[msg.sender] = User({
            account: msg.sender,
            username: _username,
            role: _role,
            isRegistered: true,
            registeredAt: block.timestamp
        });

        emit UserRegistered(msg.sender, _username, _role, block.timestamp);
    }

    /**
     * @dev Admin cấp quyền cho người dùng đã đăng ký
     * @param _account Địa chỉ người dùng
     * @param _newRole Vai trò mới
     */
    function updateRole(address _account, Role _newRole) public onlyAdmin {
        require(users[_account].isRegistered, "Nguoi dung chua dang ky");
        require(
            _newRole == Role.Buyer || _newRole == Role.Seller || _newRole == Role.Both,
            "Vai tro khong hop le"
        );
        users[_account].role = _newRole;
    }

    /**
     * @dev Xem thông tin người dùng
     */
    function getUser(address _account)
        public
        view
        returns (
            string memory username,
            Role role,
            bool isRegistered,
            uint256 registeredAt
        )
    {
        User memory u = users[_account];
        return (u.username, u.role, u.isRegistered, u.registeredAt);
    }

    // ========================================
    // PHẦN 7: MINT NFT
    // ========================================

    /**
     * @dev Seller mint NFT mới (chưa đăng bán)
     * @param _name Tên NFT
     * @param _description Mô tả NFT
     * @param _imageURI Đường dẫn ảnh
     * @return tokenId Mã NFT vừa tạo
     */

// Sửa hàm mintNFT - thêm tham số _audioURI
    function mintNFT(
        string memory _name,
        string memory _description,
        string memory _imageURI,
        string memory _audioURI    // ← THÊM
    ) public canSell returns (uint256) {
        require(bytes(_name).length > 0, "Ten NFT khong duoc trong");

        nftCounter++;

        nfts[nftCounter] = NFT({
            tokenId:      nftCounter,
            name:         _name,
            description:  _description,
            imageURI:     _imageURI,
            audioURI:     _audioURI,    // ← THÊM
            creator:      msg.sender,
            currentOwner: msg.sender,
            price:        0,
            status:       NFTStatus.Minted,
            mintedAt:     block.timestamp
        });

        emit NFTMinted(nftCounter, _name, msg.sender, block.timestamp);
        return nftCounter;
    }
    // ========================================
    // PHẦN 8: ĐĂNG BÁN NFT
    // ========================================

    /**
     * @dev Chủ NFT đăng bán trên marketplace
     * @param _tokenId Mã NFT
     * @param _price Giá bán (Wei)
     */
    function listNFT(uint256 _tokenId, uint256 _price)
        public
        canSell
        nftExists(_tokenId)
        onlyNFTOwner(_tokenId)
    {
        require(_price > 0, "Gia phai lon hon 0");
        require(
            nfts[_tokenId].status != NFTStatus.ForSale,
            "NFT dang duoc ban roi"
        );

        nfts[_tokenId].price = _price;
        nfts[_tokenId].status = NFTStatus.ForSale;

        listedTokenIds.push(_tokenId);

        emit NFTListed(_tokenId, msg.sender, _price, block.timestamp);
    }

    /**
     * @dev Chủ NFT hủy đăng bán
     * @param _tokenId Mã NFT
     */
    function delistNFT(uint256 _tokenId)
        public
        nftExists(_tokenId)
        onlyNFTOwner(_tokenId)
    {
        require(
            nfts[_tokenId].status == NFTStatus.ForSale,
            "NFT khong dang ban"
        );

        nfts[_tokenId].status = NFTStatus.Minted;
        nfts[_tokenId].price = 0;

        emit NFTDelisted(_tokenId, msg.sender, block.timestamp);
    }

    // ========================================
    // PHẦN 9: MUA NFT
    // ========================================

    /**
     * @dev Buyer mua NFT → chuyển owner (ETH giả lập, không cần gửi tiền thật)
     * @param _tokenId Mã NFT muốn mua
     */
    function buyNFT(uint256 _tokenId)
        public
        canBuy
        nftExists(_tokenId)
    {
        NFT storage nft = nfts[_tokenId];

        require(nft.status == NFTStatus.ForSale, "NFT khong duoc ban");
        require(nft.currentOwner != msg.sender, "Ban khong the tu mua NFT cua minh");

        address previousOwner = nft.currentOwner;
        uint256 salePrice = nft.price;

        // Chuyển quyền sở hữu
        nft.currentOwner = msg.sender;
        nft.status = NFTStatus.Sold;
        nft.price = 0;

        // Ghi lịch sử giao dịch
        txCounter++;
        transactions[txCounter] = Transaction({
            txId: txCounter,
            tokenId: _tokenId,
            seller: previousOwner,
            buyer: msg.sender,
            price: salePrice,
            timestamp: block.timestamp
        });

        emit NFTSold(_tokenId, previousOwner, msg.sender, salePrice, block.timestamp);
    }

    // ========================================
    // PHẦN 10: XEM DỮ LIỆU
    // ========================================

    /**
     * @dev Xem thông tin NFT
     */
    // Sửa getNFT để trả về audioURI
    function getNFT(uint256 _tokenId)
        public view nftExists(_tokenId)
        returns (
            string memory name,
            string memory description,
            string memory imageURI,
            string memory audioURI,     // ← THÊM
            string memory creatorName,
            string memory ownerName,
            uint256 price,
            NFTStatus status,
            uint256 mintedAt
        )
    {
        NFT memory nft = nfts[_tokenId];
        return (
            nft.name, nft.description,
            nft.imageURI,
            nft.audioURI,               // ← THÊM
            users[nft.creator].username,
            users[nft.currentOwner].username,
            nft.price, nft.status, nft.mintedAt
        );
    }
    /**
     * @dev Xem lịch sử giao dịch của một NFT
     * @param _tokenId Mã NFT
     */
    function getTransactionsByNFT(uint256 _tokenId)
        public
        view
        returns (uint256[] memory txIds)
    {
        uint256 count = 0;
        for (uint256 i = 1; i <= txCounter; i++) {
            if (transactions[i].tokenId == _tokenId) count++;
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= txCounter; i++) {
            if (transactions[i].tokenId == _tokenId) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /**
     * @dev Lấy tất cả NFT đang bán
     */
    function getListedNFTs() public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= nftCounter; i++) {
            if (nfts[i].status == NFTStatus.ForSale) count++;
        }

        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= nftCounter; i++) {
            if (nfts[i].status == NFTStatus.ForSale) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /**
     * @dev Tổng số NFT đã mint
     */
    function getTotalNFTs() public view returns (uint256) {
        return nftCounter;
    }

    /**
     * @dev Tổng số giao dịch
     */
    function getTotalTransactions() public view returns (uint256) {
        return txCounter;
    }

    // ========================================
    // PHẦN 11: HELPER FUNCTIONS
    // ========================================

    /**
     * @dev Chuyển NFTStatus sang chuỗi
     */
    function statusToString(NFTStatus _status)
        public
        pure
        returns (string memory)
    {
        if (_status == NFTStatus.Minted) return "Da mint";
        if (_status == NFTStatus.ForSale) return "Dang ban";
        if (_status == NFTStatus.Sold) return "Da ban";
        return "Khong xac dinh";
    }

    /**
     * @dev Chuyển Role sang chuỗi
     */
    function roleToString(Role _role)
        public
        pure
        returns (string memory)
    {
        if (_role == Role.None) return "Chua dang ky";
        if (_role == Role.Buyer) return "Nguoi mua";
        if (_role == Role.Seller) return "Nguoi ban";
        if (_role == Role.Both) return "Nguoi mua & ban";
        return "Khong xac dinh";
    }
    /**
    *@dev người dùng xóa tài khoản mình
    */
    function deleteMyaccount()public onlyRegistered(){
       require(msg.sender != admin, "Admin khong the tu xoa tai khoan");
    delete users[msg.sender];
    emit AccountDeleted(msg.sender, msg.sender, block.timestamp);
    }
    /**@dev Admin xóa tài khoản bất kì */
     function adminDeleteAccount(address _account) public onlyAdmin {
        require(_account != admin, "Khong the xoa tai khoan admin");
        require(users[_account].isRegistered, "Nguoi dung chua dang ky");
        delete users[_account];
        emit AccountDeleted(_account, msg.sender, block.timestamp);
    }
    event MediaDeleted(uint256 indexed tokenId, string mediaType, address deletedBy, uint256 timestamp);

    function adminDeleteMedia(uint256 _tokenId, string memory _mediaType)
        public onlyAdmin nftExists(_tokenId)
    {
        if (keccak256(bytes(_mediaType)) == keccak256(bytes("image"))) {
            nfts[_tokenId].imageURI = "";
        }
        // nếu có trường audioURI thì xử lý tương tự
        emit MediaDeleted(_tokenId, _mediaType, msg.sender, block.timestamp);
    }
}
