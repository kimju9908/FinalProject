import React, {useState, useEffect, useRef} from "react";
import styled from "styled-components";
import AuthApi from "../../../api/AuthApi";
import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "../../../context/Store";
import {Dialog, DialogTitle} from "@mui/material";
import {closeModal, setRejectModal} from "../../../context/redux/ModalReducer";
import {SmsTokenVerificationDto} from "../../../api/dto/AuthDto";
import {Container} from "../Style";


const InputField = styled.input`
    width: 100%;
    padding: 12px;
    margin: 10px 0;
    border-radius: 20px;
    box-sizing: border-box;
    font-size: 16px;
    border: 1px solid #d1b6a3;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    &:focus {
        border-color: #d1b6a3;
        outline: none;
     
    }
`;

const TimerText = styled.p`
    color: red;
    font-size: 14px;
    margin-top: 5px;
`;

const Button = styled.button`
    width: 100%;
    padding: 12px;
    background-color: #6a4e23;
    color: white;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-size: 16px;
    margin-top: 10px;

    &:hover {
        background-color: #6a4e23;
    }

    &:disabled {
        background-color: #d1b6a3;
        cursor: not-allowed;
    }
`;


const FindIdModal = () => {
  const findId = useSelector((state : RootState) => state.modal.findIdModal)
  const dispatch = useDispatch<AppDispatch>();
  const [phone, setPhone] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0); // 5분 타이머 (초 단위)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 모달이 닫힐 때 입력값 초기화
  useEffect(() => {
    if (!findId) {
      setPhone("");
      setInputCode("");
      setIsCodeSent(false);
      setIsSendingCode(false);
      setCountdown(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [findId]);

  useEffect(() => {
    if (isCodeSent && countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCodeSent]); // countdown을 의존성 배열에서 제외하여 무한 호출 방지


  const handleSendVerificationCode = async () => {
    setIsSendingCode(true);
    try {
      const response = await AuthApi.sendVerificationCode(phone);
      if (response) {
        setIsCodeSent(true);
        setCountdown(300); // 5분 (300초) 타이머 시작
      } else {
        dispatch((setRejectModal({message: "인증번호 발송에 실패했습니다.", onCancel: null})))
      }
    } catch (error) {
      dispatch((setRejectModal({message: "서버에서 오류가 발생했습니다.", onCancel: null})))
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      if (countdown === 0) {
        dispatch((setRejectModal({message: "인증번호가 만료되었습니다.", onCancel: null})))
        return;
      }
      const req : SmsTokenVerificationDto = {phone: phone, inputToken: inputCode};
      const response = await AuthApi.verifySmsToken(req);
      if (response) {
        const rsp = await AuthApi.findEmailByPhone(phone);
        const fullEmail = rsp.data;
        const [localPart, domainPart] = fullEmail.split("@");
        const maskedEmail =
            localPart.length > 3
                ? localPart.substring(0, 3) + "*".repeat(localPart.length - 3) + "@" + domainPart
                : localPart + "@" + domainPart;
        setIsCodeSent(false);
        dispatch((setRejectModal({message: `이메일 확인에 성공했습니다 \n 회원님의 이메일은\n${maskedEmail}\n입니다.`, onCancel: null})))
      }
    } catch (error) {
      dispatch((setRejectModal({message: "서버에서 오류가 발생했습니다.", onCancel: null})))
    }
  };

  const isPhoneValid = phone.length >= 11 && phone.length <= 12;
  const formattedTime = `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`;

  return (
      <Dialog open={findId} onClose={() => dispatch(closeModal("findId"))}>
        <Container>
          <DialogTitle>이메일 찾기</DialogTitle>
          <InputField
            type="text"
            placeholder="휴대폰 번호 입력"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isCodeSent}
          />
          <Button onClick={handleSendVerificationCode} disabled={!isPhoneValid || isSendingCode}>
            {isSendingCode ? "인증번호 보내는 중..." : "인증번호 보내기"}
          </Button>
          {isCodeSent && (
            <>
              <InputField
                type="text"
                placeholder="인증번호 입력"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                disabled={countdown === 0}
              />
              <TimerText>남은 시간: {formattedTime}</TimerText>
              <Button onClick={handleVerifyCode} disabled={countdown === 0}>인증하기</Button>
              {countdown === 0 && (
                <Button onClick={handleSendVerificationCode}>인증번호 재전송</Button>
              )}
            </>
          )}
        </Container>
      </Dialog>
  );
};

export default FindIdModal;
