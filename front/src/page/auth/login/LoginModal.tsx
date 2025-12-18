import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../../context/Store";
import {
  closeModal,
  openModal,
  setRejectModal,
} from "../../../context/redux/ModalReducer";
import Commons from "../../../util/Common";
import {
  ChangeWithSetter,
  KeyPress,
  SNSLoginType,
} from "../../../context/types";
import {
  Button,
  Container,
  InputField,
  Line,
  SignupTextButton,
  Slash,
  SnsLoginText,
  SnsSignInButton,
  SocialButtonsContainer,
  TextButton,
  TextButtonContainer,
} from "../Style";
import { setToken } from "../../../context/redux/TokenReducer";
import { loginReqDto, loginResDto } from "../../../api/dto/AuthDto";
import AuthApi from "../../../api/AuthApi";
import axios from "axios";
import { Dialog, DialogTitle, Tooltip } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComment, faN } from "@fortawesome/free-solid-svg-icons";
import GoogleIcon from "@mui/icons-material/Google";

const LoginModal = () => {
  const dispatch = useDispatch<AppDispatch>();
  const loginModal = useSelector((state: RootState) => state.modal.loginModal);
  const [inputEmail, setInputEmail] = useState<string>("");
  const [inputPw, setInputPw] = useState<string>("");

  // 모달이 닫힐 때 입력값 초기화
  useEffect(() => {
    if (!loginModal) {
      setInputEmail("");
      setInputPw("");
    }
  }, [loginModal]);


  const SNS_SIGN_IN_URL = (type: SNSLoginType) =>
    `${Commons.BASE_URL}/api/v1/auth/oauth2/${type}`;
  const onSnsSignInButtonClickHandler = (type: SNSLoginType) => {
    window.location.href = SNS_SIGN_IN_URL(type);
  };

  const onClickOpenModal = (type: "signup" | "findPw" | "findId") => {
    dispatch(closeModal("login"));
    dispatch(openModal(type));
  };

  const onClickLogin = async () => {
    try {
      const loginReq: loginReqDto = { email: inputEmail, pwd: inputPw };
      const rsp = await AuthApi.login(loginReq);
      console.log(rsp);

      const loginRes: loginResDto | null = rsp.data;
      if (loginRes !== null && loginRes.grantType === "Bearer") {
        dispatch(
          setToken({
            accessToken: loginRes.accessToken,
            refreshToken: loginRes.refreshToken,
          })
        );
        dispatch(closeModal("login"));
      } else {
        console.log("잘못된 아이디 또는 비밀번호 입니다.");
        dispatch(
          setRejectModal({ message: "ID와 PW가 다릅니다.", onCancel: () => {} })
        );
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.log("로그인 에러 : ", err);

        // 400 Bad Request - 백엔드에서 보낸 에러 메시지 표시
        if (err.response?.status === 400) {
          const errorMessage = err.response?.data || "로그인에 실패하였습니다.";
          console.log("로그인 실패:", errorMessage);
          dispatch(
            setRejectModal({
              message: errorMessage,
              onCancel: () => {},
            })
          );
        } else if (err.response?.status === 405) {
          console.log("로그인 실패: 405 Unauthorized");
          dispatch(
            setRejectModal({
              message: "로그인에 실패 하였습니다.",
              onCancel: () => {},
            })
          );
        } else {
          console.log("서버와의 통신에 실패: ", err.message);
          dispatch(
            setRejectModal({
              message: "서버와의 통신에 실패 하였습니다.",
              onCancel: () => {},
            })
          );
        }
      } else {
        console.log("예상치 못한 에러 발생: ", err);
        dispatch(
          setRejectModal({
            message: "알 수 없는 오류가 발생하였습니다.",
            onCancel: () => {},
          })
        );
      }
    }
  };

  const handleKeyPress: KeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // 엔터 키가 눌렸을 때
      onClickLogin(); // 로그인 버튼 클릭 함수 실행
    }
  };
  const handleInputChange: ChangeWithSetter<string> = (e, setter) => {
    setter(e.target.value);
  };

  return (
    <Dialog
      open={loginModal}
      onClose={() => dispatch(closeModal("login"))}
      sx={{ padding: "10px" }}
    >
      <DialogTitle>로그인</DialogTitle>
      <Container>
        <form onSubmit={(e) => e.preventDefault()}>
          <InputField
            type="text"
            placeholder="이메일"
            value={inputEmail}
            onChange={(e) => handleInputChange(e, setInputEmail)}
            onKeyDown={handleKeyPress}
          />
          <InputField
            type="password"
            placeholder="비밀번호"
            value={inputPw}
            onChange={(e) => handleInputChange(e, setInputPw)}
            onKeyDown={handleKeyPress}
          />
          <Button type="button" onClick={onClickLogin}>
            로그인
          </Button>

          {/* 아이디찾기 / 비밀번호 찾기 */}
          <TextButtonContainer>
            <div>
              <TextButton onClick={() => onClickOpenModal("findId")}>
                이메일 찾기
              </TextButton>
              <Slash>/</Slash>
              <TextButton onClick={() => onClickOpenModal("findPw")}>
                비밀번호 찾기
              </TextButton>
            </div>
            <SignupTextButton onClick={() => onClickOpenModal("signup")}>
              회원가입
            </SignupTextButton>
          </TextButtonContainer>
          {/* 라인 및 SNS 로그인 섹션 */}
          <Line />
          <SnsLoginText>SNS 계정 간편 로그인</SnsLoginText>
          <SocialButtonsContainer>
            <Tooltip title="네이버 로그인">
              <SnsSignInButton
                onClick={() => onSnsSignInButtonClickHandler("naver")}
                color="white"
                bgColor="#03C75A"
              >
                <FontAwesomeIcon icon={faN} />
              </SnsSignInButton>
            </Tooltip>
            <Tooltip title="카카오 로그인">
              <SnsSignInButton
                onClick={() => onSnsSignInButtonClickHandler("kakao")}
                color="#3C1E1E"
                bgColor="#FEE500"
              >
                <FontAwesomeIcon icon={faComment} />
              </SnsSignInButton>
            </Tooltip>
            <Tooltip title="구글 로그인">
              <SnsSignInButton
                onClick={() => onSnsSignInButtonClickHandler("google")}
                color="white"
                bgColor="#4285F4"
              >
                <GoogleIcon />
              </SnsSignInButton>
            </Tooltip>
          </SocialButtonsContainer>
        </form>
      </Container>
    </Dialog>
  );
};

export default LoginModal;
