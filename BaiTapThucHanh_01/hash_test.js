const crypto = require('crypto');
console.log("Hi Bro");
function createSHA256(data){
    return crypto.createHash('sha256').update(data).digest('hex');
}
console.log(`==== Bài tập 1: Tạo hàm băm SHA-256 ====`);
const input1= "Tôi tên Tuấn Ngọc";
const input2= "tôi tên tuấn ngọc";
const input3= "Tôi tên Tuấn";
const input4= "Tôi tên Tuấn Ngọc ";

const hash1 = createSHA256(input1);
const hash2 = createSHA256(input2);
const hash3 = createSHA256(input3); 
const hash4 = createSHA256(input4);

console.log (` Dữ Liệu Gốc:`);
console.log("Input 1"+": "+ input1);
console.log("Input 2"+": "+ input2);
console.log("Input 3"+": "+ input3);
console.log("Input 4"+": "+ input4);    

console.log (`Mã Hash SHA-256:`);
console.log("Hash 1"+": "+ hash1);
console.log("Hash 2"+": "+ hash2);
console.log("Hash 3"+": "+ hash3);
console.log("Hash 4"+": "+ hash4);

console.log(`Độ Dài Mã Hash SHA-256:`);
console.log("Độ dài Hash 1"+": "+ hash1.length+" ký tự");
console.log("Độ dài Hash 2"+": "+ hash2.length+" ký tự");
console.log("Độ dài Hash 3"+": "+ hash3.length+" ký tự");
console.log("Độ dài Hash 4"+": "+ hash4.length+" ký tự");    