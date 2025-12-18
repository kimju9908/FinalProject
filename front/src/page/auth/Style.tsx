import styled from "styled-components";
import React from "react";
import {IconButton} from "@mui/material";



export const SocialButtonsContainer = styled.div`
  display: flex;
  justify-content: space-evenly;  
`;

interface SnsSignInButtonProps {
  bgColor?: string;
  color?: string;
}

export const SnsSignInButton = styled(IconButton).attrs<SnsSignInButtonProps>(
  (props) => ({
    style: {
      backgroundColor: props.bgColor || "white",
      color: props.color || "white",
    },
  })
)`
    height: 50px;
    width: 50px;
    border-radius: 50%;
    cursor: pointer;
    margin-top: 10px;
`;


// 모달 콘텐츠
export const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;

    // 모바일 환경에서는 꽉 찬 너비, PC에서는 너비 제한
    width: 100%;
    max-width: 600px;
    margin: 0 auto;

    // 모바일 환경에서 padding 조정
    @media (max-width: 768px) {
        padding: 10px;
    }
`;

// 입력 필드 스타일
export const InputField = styled.input`
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border: 1px solid #c3a97e;
  border-radius: 20px;
  box-sizing: border-box;
  font-size: 16px;
  
  
  &:focus {
    border-color: #6a4e23; /* 클릭 시 변경할 테두리 색상 */
    outline: none; /* 기본 파란색 아웃라인 제거 */
    box-shadow: 0 0 5px rgba(106, 78, 35, 0.5); /* 클릭 시 부드러운 그림자 효과 */
  }
`;

// 버튼 스타일
export const Button = styled.button`
  width: 100%;
  padding: 12px;
  background-color: #6a4e23;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); // 쉐도우 추가
  
  &:hover {
    background-color: #c3a97e;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); // Hover 시 쉐도우 강조
  }
`;

// 텍스트 버튼 스타일
export const TextButtonContainer = styled.div`
  margin-top: 25px;
  display: flex;
  justify-content: space-between; /* Spread the buttons */
  align-items: center;
  width: 100%;
`;

export const TextButton = styled.button`
  background: none;
  border: none;
  color: black;
  cursor: pointer;
  font-size: 12px; // Reduced font size
  text-decoration: underline;
  margin-right: 8px; // Space between 아이디 찾기 and 비밀번호 찾기
  
  &:hover {
    color: #c1c1c1;
  }
`;

export const Slash = styled.span`
  margin-right: 8px;
  color: black;
  font-size: 12px; // Reduced font size
`;

export const SignupTextButton = styled.button`
  background: none;
  border: none;
  color: black;
  cursor: pointer;
  font-size: 12px; // Reduced font size
  text-decoration: underline;
  
  &:hover {
    color: #c1c1c1;
  }
`;

export const Line = styled.div`
  width: 100%;
  height: 1px;
  background-color: #ccc;
  margin: 20px 0;
`;

export const SnsLoginText = styled.div`
  font-size: 14px;
  color: black;
  margin-bottom: 10px;
`;

export const ProfileWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin: 30px 0 20px 0;
`;

export const ProfileImage = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    font-size: 18px;
  }
`;

export const FileInputLabel = styled.label`
  position: absolute;
  bottom: 5px;
  right: 5px;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 5px;
  cursor: pointer;
  border-radius: 50%;
`;

export const FileInput = styled.input`
  display: none;
`;

export const ModalContainer = styled.div`
  border-radius: 25px;
  z-index: 1000;
  background-color: ${({ theme }) => theme.background || "white"};
  padding: 20px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
 
`;

export const InputContainer = styled.div`
  margin-bottom: 5px;
  width: 100%;  
  display: flex;
  justify-content: center;
  flex-direction: column;
`;

export const Input = styled.input`
  width: 100%;  
  padding: 9px;
  margin-bottom: 2px;
  border: 1px solid ${({ theme }) => theme.border || "#c3a97e"}; /* 연한 브라운 */
  border-radius: 15px;
  font-size: 16px;
  box-sizing: border-box;
  background-color: ${({ theme }) => theme.inputBackground || "white"};
  color: ${({ theme }) => theme.inputTextColor || "black"};
  outline: none;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); // 쉐도우 추가

  &:focus {
    border-color: #6a4e23; /* 클릭 시 변경할 테두리 색상 (진한 브라운) */
    outline: none; /* 기본 파란색 아웃라인 제거 */
    box-shadow: 0 0 5px rgba(106, 78, 35, 0.5); /* 클릭 시 부드러운 그림자 효과 */
  }

  &::placeholder {
    font-size: 12px;  
    color: ${({ theme }) => theme.placeholderColor || "#a08156"}; /* placeholder 색을 중간 톤으로 변경 */
  }
`;


export const PhoneVerifyButton = styled.button`
  padding: 9px;
  font-size: 16px;
  color: ${({ theme }) => theme.buttonTextColor || "white"};
  background-color: ${({ disabled, theme }) => 
    disabled ? theme.disabledButton || "#c3a97e" : theme.buttonBackground || "#c3a97e"};
  border: none;
  border-radius: 20px;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};

  &:hover {
    background-color: ${({ disabled, theme }) => 
      disabled ? theme.disabledButtonHover || "#c3a97e" : theme.buttonHover || "#c3a97e"};
  }
`;


export const Message = styled.p<{isValid : boolean}>`
  color: ${(props) => (props.isValid ? (props.theme.validMessage || 'green') : (props.theme.invalidMessage || 'red'))}; /* 메시지 색상 */
  text-align: right;
  font-size: 13px;
`;

export const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
   margin-top: 30px; // 가입하기 버튼과 약관 동의 사이의 간격을 넓힘
`;

export const SignupButton = styled.button`
  padding: 15px 30px;
  font-size: 16px;
  color: ${({ theme }) => theme.buttonTextColor || "white"};
  background-color: ${({ disabled, theme }) => (disabled ? theme.disabledButton || "#6a4e23" : theme.buttonBackground || "#dccafc")};
  border: none;
  border-radius: 20px;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  &:hover {
    background-color: ${({ disabled, theme }) => (disabled ? theme.disabledButtonHover || "#6a4e23" : theme.buttonHover || "#dccafc")};
  }
`;
export const TermsWrapper = styled.div`
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #6a4e23;
  border-radius: 15px;
  text-align: left; // 왼쪽 정렬
`;

export const TermsHeader = styled.h4`
  color: #6a4e23;
  text-align: left; // 왼쪽 정렬
`;

export const TermContainer = styled.div`
  display: flex;
  align-items: center; /* 체크박스와 텍스트 세로 중앙 정렬 */
  margin-bottom: 6px;
  gap: 8px; /* 체크박스와 텍스트 사이의 간격 */
`;

export const TermLabel = styled.label`
  color: #333;
  font-size: 14px;
  margin-left: 8px; /* 텍스트와 체크박스 사이의 간격 */
`;

export const TermLink = styled.span`
  color: #6a4e23;
  cursor: pointer;
  text-decoration: underline;
`;

export const CloseButton = styled.button`
  padding: 10px 20px;
  background-color: #6a4e23;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;

  &:hover {
    background-color: #5a3d1e; /* 버튼 호버 시 더 어두운 브라운 */
  }
`;

export const TermsCheckbox = styled.input`
  appearance: none; /* 기본 브라우저 스타일 제거 */
  width: 16px;
  height: 16px;
  border: 2px solid #6a4e23; /* 체크박스 테두리 */
  border-radius: 4px;
  position: relative;
  cursor: pointer;
  
  &:checked {
    background-color: #6a4e23; /* 체크되었을 때 배경색 */
    border-color: #6a4e23;
  }

  &:checked::before {
    content: "✔"; /* 체크 표시 */
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: white; /* 체크 표시 색 */
    font-size: 12px;
    font-weight: bold;
  }
`;

const TermsContainer = styled.div`
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  padding: 10px;
  border: 1px solid #6a4e23;
  border-radius: 15px;
  background-color: ${({ theme }) => theme.inputBackground || "#c3a97e"};
`;
