package com.kh.back.dto.admin.res;

import com.kh.back.constant.Authority;
import lombok.*;

@Getter @Setter @ToString
@NoArgsConstructor @AllArgsConstructor
public class MemberListResDto {
	private Long id;
	private String name;
	private Authority authority;
	
}
