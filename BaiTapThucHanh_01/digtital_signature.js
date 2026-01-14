 const crypto =require("crypto");
 const fs= require("fs");
 console.log ("==== THỰC HÀNH: CHỮ KÝ SỐ & XÁC THỰC ====\n");
 console.log(" BƯỚC 1. Tạo cặp khóa công khai và khóa riêng tư RSA\n");
 const {generateKeyPairSync}= crypto;
 const {publicKey, privateKey}= generateKeyPairSync("rsa",{
    modulusLength:2048,
    publicKeyEncoding:{
        type:"spki",
        format:"pem"
    },privateKeyEncoding:{
        type:"pkcs8",
        format:"pem",
    }
 });
 console.log("Public key (có thể chia sẻ):");
 console.log(publicKey.substring(0,50)+"..."); //chỉ in 1 phần khóa công khai
console.log("Private key (tuyệt đối không chia sẻ):");
console.log(privateKey.substring(0,50)+"...");
//bước 2 tạo chữ ký ch 1 thông điệp
const message= "Tôi,Tống Ngọc Tuấn, Đớp 100 BTC cho riêng mình";
const signer =crypto.createSign("sha256");
signer.update(message);
const signature =signer.sign(privateKey,"hex");
console.log("Thông điệp"+message);
console.log("Chữ ký số"+signature);

//Bước 3 Xác minh chữu ký số

console.log("\nBƯỚC 3: XÁC MINH CHỮ KÝ SỐ (Phía người nhận) \n");
const verifier =crypto.createVerify("sha256");
verifier.update(message);
const isValid= verifier.verify (publicKey, signature,"hex");    
console.log("Thông điệp"+message);
console.log("Kết quẩ xác minh"+((isValid)? "Hợp lệ, đúng như người gửi đã ký":"Không hợp lệ, có thể đã bị thay đổi hoặc không phải người gửi đã ký"));

//Bước 4 thử giả mạo thông điệp
console.log("\nBƯỚC 4: THỬ GIẢ MẠO THÔNG ĐIỆP \n");
const fakeMessage ="Tôi,Tống Ngọc Tuấn, Đớp 1000 BTC cho riêng mình";
const verifierF= crypto.createVerify("sha256");
verifierF.update(fakeMessage);
const isValidF= verifierF.verify(publicKey, signature,"hex");
console.log("Thông điệp giả mạo"+fakeMessage);
console.log("Kết quả xác minh"+((isValidF)? "Hợp lệ, đúng như người gửi đã ký":"Không hợp lệ, có thể đã bị thay đổi hoặc không phải người gửi đã ký"));

/// Bước 5 thử ký bằng khóa sai 
console.log("BƯỚC 5:  Try verify bằng khóa sai \n");
const {publicKey:publicKey2}= generateKeyPairSync("rsa",{
    modulusLength:2048,
    publicKeyEncoding:{
        type:"spki",
        format:"pem"
    },privateKeyEncoding:{
        type:"pkcs8",
        format:"pem",
    }
    });
const verifierWrongKey =crypto.createVerify("sha256");
verifierWrongKey.update(message);
const isWrongKeyValid= verifierWrongKey.verify (publicKey2, signature,"hex");

console.log("PublicKey khác"+publicKey2);
console.log("Thông điệp"+fakeMessage);
console.log("Kết quả xác minh"+((isWrongKeyValid)? "Hợp lệ, đúng như người gửi đã ký":"Không hợp lệ, có thể đã bị thay đổi hoặc không phải người gửi đã ký"));
