    package com.kh.back.config;

    import com.kh.back.dto.auth.TokenDto;
    import com.kh.back.entity.member.Member;
    import com.kh.back.entity.auth.RefreshToken;
    import com.kh.back.jwt.TokenProvider;
    import com.kh.back.repository.member.MemberRepository;
    import com.kh.back.repository.auth.RefreshTokenRepository;
    import lombok.RequiredArgsConstructor;
    import lombok.extern.slf4j.Slf4j;
    import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
    import org.springframework.security.core.Authentication;
    import org.springframework.security.core.GrantedAuthority;
    import org.springframework.security.core.authority.SimpleGrantedAuthority;
    import org.springframework.security.oauth2.core.user.OAuth2User;
    import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
    import org.springframework.stereotype.Component;

    import javax.servlet.ServletException;
    import javax.servlet.http.HttpServletRequest;
    import javax.servlet.http.HttpServletResponse;
    import java.io.IOException;
    import java.time.LocalDateTime;
    import java.util.Collections;
    import java.util.List;

    @Slf4j
    @Component
    @RequiredArgsConstructor
    public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {
        private final TokenProvider tokenProvider;
        private final RefreshTokenRepository refreshTokenRepository;
        private final MemberRepository memberRepository;

        @Override
        public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                            Authentication authentication) throws IOException, ServletException {
            log.warn("authentication 확인 : {}", authentication);

            // CustomOAuth2User로 캐스팅
            OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
            String userId = oAuth2User.getName(); // OAuth2 ID (예: 구글 ID, 네이버 ID)

            Member member = memberRepository.findByUserId(userId)
                .orElseGet(() -> {
                        // 회원이 없으면 새로 생성
                    Member newMember = new Member("google_" + userId.substring(0, 14), oAuth2User.getAttribute("email"), "google",
                        null, (String) oAuth2User.getAttributes().get("name"), "google_" + userId.substring(0, 14), LocalDateTime.now());
                    return memberRepository.save(newMember);  // 새로운 회원 저장
                });

            // DB에서 userId로 회원 정보 조회

            // memberId와 role 가져오기
            String memberId = String.valueOf(member.getMemberId()); // Member 테이블의 PK
            String authority = member.getAuthority().name(); // 예: "ROLE_USER", "ROLE_ADMIN"

            // 새로운 Authentication 객체 생성 (Spring Security용)
            List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority(authority));
            Authentication newAuth = new UsernamePasswordAuthenticationToken(memberId, null, authorities);

            // JWT 생성 (memberId와 role을 포함)
            TokenDto tokenDto = tokenProvider.generateTokenDto(newAuth);
            log.info("Exists by member: {}", refreshTokenRepository.existsByMember(member));
            if (refreshTokenRepository.existsByMember(member)) {
                refreshTokenRepository.deleteByMember(member);
            }

            RefreshToken refreshToken = new RefreshToken();
            String encodedToken = tokenDto.getRefreshToken();
            refreshToken.setRefreshToken(encodedToken);
            refreshToken.setRefreshTokenExpiresIn(tokenDto.getRefreshTokenExpiresIn());
            refreshToken.setMember(member);

            refreshTokenRepository.save(refreshToken);

            // 액세스 토큰을 가져와서 리다이렉트 URL에 포함시킴
            String token = tokenDto.getAccessToken();

            // 만료 시간을 설정 (예: 3600초 = 1시간)
            long expirationTime = tokenDto.getAccessTokenExpiresIn() / 1000; // 밀리초를 초로 변환

            // 프론트엔드로 리다이렉트하면서 토큰과 만료 시간을 전달
            response.sendRedirect("https://uniguide.shop/auth/oauth-response/" + token + "/" + expirationTime);
        }
    }
