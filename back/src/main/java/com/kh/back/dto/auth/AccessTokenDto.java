package com.kh.back.dto.auth;


import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccessTokenDto {
    private String grantType;
    private String accessToken;
    private long accessTokenExpiresIn;
}