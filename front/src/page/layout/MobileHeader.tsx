import {
  DropDownButton,
  DropDownSection,
  HamburgerIcon,
  MenuItem,
  Navbar,
  NavContainer,
  NavLink,
  TopSection,
} from "./style/HeaderStyle";
import { useLocation, useNavigate } from "react-router-dom";
import { openModal } from "../../context/redux/ModalReducer";
import { handleLogout } from "../../context/redux/CommonAction";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../context/Store";
import { useState } from "react";
import React from "react";
import { HiMenu } from "react-icons/hi";
import styled from "styled-components";
import { toast } from "react-toastify";

const MobileHeader = () => {
  const navigator = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const guest = useSelector((state: RootState) => state.user.guest);
  const admin = useSelector((state: RootState) => state.user.admin);
  const [dropdown, setDropdown] = useState<boolean>(false);

  const menuList: { name: string; path: string }[] = [
    { path: "/about", name: "About" },
    { path: "/contact", name: "Contact" },
    { path: "/forum", name: "Forum" },
  ];
  const profileList: { name: string; fn: () => void | Promise<void> }[] = guest
    ? [
        {
          name: "로그인",
          fn: () => {
            dispatch(openModal("login"));
          },
        },
        {
          name: "회원 가입",
          fn: () => {
            dispatch(openModal("signup"));
          },
        },
      ]
    : admin
    ? [
        { name: "프로필", fn: () => navigator("/profile") },
        { name: "관리자 페이지", fn: () => navigator("/admin") },
        {
          name: "로그아웃",
          fn: () => {
            dispatch(handleLogout());
          },
        },
      ]
    : [
        { name: "프로필", fn: () => navigator("/profile") },
        {
          name: "로그아웃",
          fn: () => {
            dispatch(handleLogout());
          },
        },
      ];

  return (
    <Navbar>
      <NavContainer>
        <div>Logo</div>
        <TopSection>
          <HamburgerIcon onClick={() => setDropdown(!dropdown)}>
            <HiMenu />
          </HamburgerIcon>
        </TopSection>
        <MobileMenu isMenuOpen={dropdown}>
          {profileList.map((profile) => (
            <MenuItem key={profile.name}>
              <DropDownButton
                onClick={() => {
                  profile.fn();
                  setDropdown(false);
                }}
              >
                {profile.name}
              </DropDownButton>
            </MenuItem>
          ))}
          {menuList.map(({ path, name }) => (
            <MenuItem key={path}>
              <NavLink to={path} end>
                {name}
              </NavLink>
            </MenuItem>
          ))}
          <MenuItem>
            <DropDownSection
              className={
                location.pathname.includes("recipe") ? "active" : "no-underline"
              }
            >
              <MenuItem>Recipe</MenuItem>
              <MenuItem>
                <DropDownButton onClick={() => navigator("/recipe/food")}>
                  Food Recipe
                </DropDownButton>
              </MenuItem>
              <MenuItem>
                <DropDownButton onClick={() => navigator("/recipe/cocktail")}>
                  Cocktail Recipe
                </DropDownButton>
              </MenuItem>
            </DropDownSection>
          </MenuItem>
        </MobileMenu>
      </NavContainer>
    </Navbar>
  );
};
export default MobileHeader;

// 모바일 메뉴 (햄버거 클릭 시 표시)
export const MobileMenu = styled.div<{ isMenuOpen: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: #fff;
  border: 1px solid #6a4e23;
  border-top: none;
  width: 45%;
  position: fixed;
  top: 72px;
  right: 0;
  z-index: 50;
  padding: 2rem 0;
  box-shadow: -2px 4px 8px rgba(0, 0, 0, 0.2);
  gap: 2rem;
  transform: translateX(120%); /* 처음엔 화면 밖 */
  transition: transform 0.3s ease-in-out; /* 애니메이션 */

  ${({ isMenuOpen }) => isMenuOpen && `transform: translateX(0);`}
`;
