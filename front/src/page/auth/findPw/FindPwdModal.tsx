import React, {useState, useEffect, useRef} from "react";
import styled from "styled-components";
import PasswordModal from "./PasswordModal";
import AuthApi from "../../../api/AuthApi";
import { closeModal, setRejectModal } from "../../../context/redux/ModalReducer";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../../context/Store";
import { Dialog, DialogTitle } from "@mui/material";
import { Change } from "../../../context/types";
import {EmailTokenVerificationDto} from "../../../api/dto/AuthDto";
import { Container } from "../Style";

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

const FindPwdModal = () => {
  const [inputEmail, setInputEmail] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const findPw = useSelector((state: RootState) => state.modal.findPwModal);
  const [isValid, setValid] = useState(false);
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 모달이 닫힐 때 입력값 초기화
  useEffect(() => {
    if (!findPw) {
      setInputEmail("");
      setInputCode("");
      setIsCodeSent(false);
      setIsSendingCode(false);
      setCountdown(0);
      setIsPasswordModalOpen(false);
      setValid(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [findPw]);

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

  const onChangeEmail: Change = (e) => {
    setInputEmail(e.target.value);
    setValid(regex.test(e.target.value));
  };

  const handleSendVerificationCode = async () => {
    setIsSendingCode(true);
    try {
      const rsp = await AuthApi.emailExists(inputEmail);
      if (rsp.data) {
        const emailResponse = await AuthApi.sendPw(inputEmail);
        if (emailResponse) {
          setIsCodeSent(true);
          setCountdown(300);
        } else {
          dispatch(setRejectModal({ message: "인증번호 전송에 실패했습니다.", onCancel: null }));
        }
      } else {
        dispatch(setRejectModal({ message: "없는 사용자입니다.", onCancel: null }));
      }
    } catch (e) {
      console.error("오류 발생:", e);
      dispatch(setRejectModal({ message: "서버가 응답하지 않습니다.", onCancel: null }));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (countdown === 0) {
      dispatch(setRejectModal({ message: "인증번호가 만료되었습니다. 다시 시도해주세요.", onCancel: null }));
      return;
    }
    try {
      const req : EmailTokenVerificationDto = {inputToken : inputCode, email : inputEmail};
      const rsp = await AuthApi.verifyEmailToken(req);
      if (rsp) {
        setIsCodeSent(false);
        setIsPasswordModalOpen(true);
      } else {
        dispatch(setRejectModal({ message: "잘못된 인증번호입니다.", onCancel: null }));
      }
    } catch (e) {
      console.error("오류 발생:", e);
      dispatch(setRejectModal({ message: "인증번호 확인에 실패했습니다.", onCancel: null }));
    }
  };

  return (
    <Dialog open={findPw} onClose={() => dispatch(closeModal("findPw"))}>
      <Container>
        <DialogTitle>비밀번호 찾기</DialogTitle>
        <InputField
          type="email"
          placeholder="등록된 이메일을 입력하세요"
          value={inputEmail}
          onChange={onChangeEmail}
          disabled={isCodeSent}
        />
        <Button onClick={handleSendVerificationCode} disabled={!isValid || isSendingCode}>
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
            {countdown > 0 ? (
              <TimerText>남은 시간: {`${Math.floor(countdown / 60)}:${countdown % 60}`}</TimerText>
            ) : (
              <TimerText>인증번호가 만료되었습니다. 다시 요청하세요.</TimerText>
            )}
            <Button onClick={handleVerifyCode} disabled={countdown === 0}>
              인증하기
            </Button>
            {countdown === 0 && <Button onClick={handleSendVerificationCode}>인증번호 재전송</Button>}
          </>
        )}
        <PasswordModal open={isPasswordModalOpen} onClose={() => {
          dispatch(closeModal("findPw"));
          setIsPasswordModalOpen(false);
        }} />
      </Container>
    </Dialog>
  );
};

export default FindPwdModal;
