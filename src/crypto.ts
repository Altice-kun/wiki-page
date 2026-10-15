import crypto from 'node:crypto';

// AES-256-ECBによる暗号化ヘルパー
function aes256EcbEncrypt(plainText: string, keyStr: string): string {
  // 鍵を32バイトに調整（足りない場合はパディング、超過する場合は切り捨て/ハッシュ）
  const key = crypto.createHash('sha256').update(keyStr).digest();
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// バイナリ文字列の1/0反転と両端への"1"付与、10進数変換処理
function transformBitString(hexStr: string, addValue: number): string {
  // 16進数をバイト列から2進数文字列へ変換
  const buffer = Buffer.from(hexStr, 'hex');
  let bitString = '';
  for (const byte of buffer) {
    bitString += byte.toString(2).padStart(8, '0');
  }

  // 1と0を反転
  let inverted = '';
  for (const char of bitString) {
    inverted += char === '0' ? '1' : '0';
  }

  // 最初と最後に1を付け足す
  const wrapped = '1' + inverted + '1';

  // 10進数のBigIntに変換し、指定の値を足す
  const decimalVal = BigInt('0b' + wrapped) + BigInt(addValue);

  return decimalVal.toString();
}

/**
 * AEAアルゴリズムに基づく暗号化処理
 * @param accountPassword ユーザーアカウントのパスワード
 * @param localPasscode サーバーに記録しない4桁のローカルパスコード
 */
export function encryptWithAEA(accountPassword: string, localPasscode: string): string {
  // 1. アカウントのパスワードをローカルパスコードを鍵にAES256で暗号化
  const step1 = aes256EcbEncrypt(accountPassword, localPasscode);

  // 2. AES256-ECB(鍵は101011101010HNMT)で暗号化
  const step2 = aes256EcbEncrypt(step1, '101011101010HNMT');

  // 3. AES256-ECB(鍵はh1001n101m11t01)で3回暗号化
  let step3 = step2;
  const key3 = 'h1001n101m11t01';
  for (let i = 0; i < 3; i++) {
    step3 = aes256EcbEncrypt(step3, key3);
  }

  // 4. 「AEA」を付け足す
  const step4 = step3 + 'AEA';

  // 5. AES256-ECB(鍵はNtltarkoayo0iace)で暗号化
  const step5 = aes256EcbEncrypt(step4, 'Ntltarkoayo0iace');

  // 6. 1と0を反転、最初と最後に1、10進数変換、10698を足す
  const step6 = transformBitString(step5, 10698);

  // 7. AES256-ECB(鍵はAEA7070580152470)で3回暗号化
  let step7 = step6;
  const key7 = 'AEA7070580152470';
  for (let i = 0; i < 3; i++) {
    step7 = aes256EcbEncrypt(step7, key7);
  }

  // 8. 「AEA」を付け足す
  const step8 = step7 + 'AEA';

  // 9. 1と0を反転、最初と最後に1、10進数変換、12964を足してファイル化（完了）
  const finalEncrypted = transformBitString(step8, 12964);

  return finalEncrypted;
}
