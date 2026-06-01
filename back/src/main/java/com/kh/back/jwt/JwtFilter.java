package com.kh.back.jwt;

import com.kh.back.service.auth.RedisTokenBlacklistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

@Slf4j
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    public static final String AUTHORIZATION_HEADER = "Authorization";
    public static final String BEARER_PREFIX = "Bearer ";

    private final TokenProvider tokenProvider;
    private final RedisTokenBlacklistService blacklistService;

    private String resolveToken(HttpServletRequest request) {
        String bearerToken = request.getHeader(AUTHORIZATION_HEADER);
        if (bearerToken != null && bearerToken.startsWith(BEARER_PREFIX)) {
            return bearerToken.substring(7);
        }
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String jwt = resolveToken(request);
        if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
            // 블랙리스트 등록된 토큰(로그아웃된 토큰)은 인증 처리하지 않음
            if (blacklistService.isBlacklisted(jwt)) {
                log.warn("[JwtFilter] 블랙리스트에 등록된 토큰으로 요청 차단: uri={}", request.getRequestURI());
                filterChain.doFilter(request, response);
                return;
            }
            Authentication authentication = tokenProvider.getAuthentication(jwt);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }
}
