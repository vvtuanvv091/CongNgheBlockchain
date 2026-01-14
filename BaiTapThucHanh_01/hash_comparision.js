const crypto = require('crypto');
console.log("Hi Bro");
function createHash(algorithm,data){
    return crypto.createHash(algorithm).update(data).digest('hex');
}
console.log(`==== Bài tập 2: So sánh các thuật toán HASH ====`);
const data = "Blockchain Bitcoin Ethereum";
console.log ("Input :"+data);
console.log('');
const hashSHA1= createHash('sha1',data);
const hashSHA256= createHash('sha256',data);
const hashSHA512= createHash('sha512',data); 
const hashMD5= createHash('md5',data);

console.log("SHA-1: "+ hashSHA1+" (Độ dài: "+ hashSHA1.length+" ký tự)");
console.log("SHA-256: "+ hashSHA256+" (Độ dài: "+ hashSHA256.length+" ký tự)");
console.log("SHA-512: "+ hashSHA512+" (Độ dài: "+ hashSHA512.length+" ký tự)");
console.log("MD5: "+ hashMD5+" (Độ dài: "+ hashMD5.length+" ký tự)");

console.log("\n NHẬN XÉT");
console.log (" -SHA-256 được sử dụng trong Bitcoin (256 bits =64 hex char");
console.log(" -SHA-512 an toàn hơn được nhưng chậm hơn (512 bits=128 hex char)");
console.log(" -SHA-1  không còn an toàn và dần bị thay thế (160 bits=40 hex char)");
console.log(" -MD5 không còn sử dụng và dễ bị crack (128 bits=32 hex char)\n");