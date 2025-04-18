// read-only
const fetch = require("node-fetch");

// TODO: 개발자센터에 로그인해서 내 결제위젯 연동 키 > 시크릿 키를 입력하세요. 시크릿 키는 외부에 공개되면 안돼요.
// @docs https://docs.tosspayments.com/reference/using-api/api-keys
const secretKey = "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";

async function confirmPayment(paymentInfo = {}) {
  const { paymentKey, orderId, amount } = paymentInfo;

  // 토스페이먼츠 API는 시크릿 키를 사용자 ID로 사용하고, 비밀번호는 사용하지 않습니다.
  // 비밀번호가 없다는 것을 알리기 위해 시크릿 키 뒤에 콜론을 추가합니다.
  // @docs https://docs.tosspayments.com/reference/using-api/authorization#%EC%9D%B8%EC%A6%9D
  const encryptedSecretKey =
    "Basic " + Buffer.from(secretKey + ":").toString("base64");

  // ------ 결제 승인 API 호출 ------
  // @docs https://docs.tosspayments.com/guides/v2/payment-widget/integration#결제-승인-api-호출하기
  const response = await fetch(
    "https://api.tosspayments.com/v1/payments/confirm",
    {
      method: "POST",
      body: JSON.stringify({ orderId, amount, paymentKey }),
      headers: {
        Authorization: encryptedSecretKey,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await response.json();
  console.log(data);

  return data;
}

module.exports = { confirmPayment };
