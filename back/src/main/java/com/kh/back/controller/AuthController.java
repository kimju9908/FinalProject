	package com.kh.back.controller;

	import com.kh.back.dto.auth.AccessTokenDto;
	import com.kh.back.dto.auth.LoginDto;
	import com.kh.back.dto.auth.SignupDto;
	import com.kh.back.dto.auth.TokenDto;
	import com.kh.back.dto.auth.requset.EmailTokenVerificationDto;
	import com.kh.back.dto.auth.requset.SmsTokenVerificationDto;
	import com.kh.back.jwt.TokenProvider;
	import com.kh.back.service.member.MemberService;
	import com.kh.back.service.auth.AuthService;
	import com.kh.back.service.auth.EmailService;
	import com.kh.back.service.auth.SmsService;
	import lombok.RequiredArgsConstructor;
	import lombok.extern.slf4j.Slf4j;
	import org.springframework.http.ResponseEntity;
	import org.springframework.security.crypto.password.PasswordEncoder;
	import org.springframework.web.bind.annotation.*;
	import org.springframework.web.multipart.MultipartFile;
	
	import java.util.Map;
	
	
	@Slf4j
	@CrossOrigin(origins = "http://localhost:3000")
	@RestController
	@RequestMapping("/auth")
	@RequiredArgsConstructor
	public class AuthController {
		private final AuthService authService;
		private final SmsService smsService;
		private final EmailService emailService;
		private final PasswordEncoder passwordEncoder;
		
		// 회원가입 여부 확인 , 이메일 중복 확인
		@GetMapping("/email/{email}")
		public ResponseEntity<Boolean> existEmail(@PathVariable String email) {
			boolean isMember = authService.existEmail(email);
			log.info("isMember : {}", isMember);
			return ResponseEntity.ok(isMember);
		}

		// 닉네임 중복 확인
		@GetMapping("/nickname/{nickname}")
		public ResponseEntity<Boolean> existNickName(@PathVariable String nickname) {
			boolean existNickName = authService.existNickName(nickname);
			log.info("existNickName : {}", existNickName);
			return ResponseEntity.ok(existNickName);
		}

		@GetMapping("/phone/{phone}")
		public ResponseEntity<Boolean> existPhone(@PathVariable String phone) {
			boolean existPhone = authService.existPhone(phone);
			log.info("existPhone : {}", existPhone);
			return ResponseEntity.ok(existPhone);
		}

////		// 회원 가입
//		@PostMapping("/signup")
//		public ResponseEntity<String> signup(@RequestBody SignupDto signupDto) {
//			String  isSuccess = authService.signup(signupDto);
//			return ResponseEntity.ok(isSuccess);
//		}

@PostMapping("/signup")
public ResponseEntity<String> signup(
		@ModelAttribute SignupDto signupDto,
		@RequestParam(required = false) MultipartFile profileImage) {
	String isSuccess = authService.signup(signupDto, profileImage);
	return ResponseEntity.ok(isSuccess);
}


		// 이메일 전송 - 비밀번호 찾기
		@PostMapping("/sendPw")
		public ResponseEntity<Boolean> sendPw(@RequestBody String email) {
			log.info("메일:{}", email);
			boolean result = emailService.sendPasswordResetToken(email);
			return ResponseEntity.ok(result);
		}

		// 이메일 인증 토큰 검증
		@PostMapping("/verify/email")
		public ResponseEntity<Boolean> verifyEmailToken(@RequestBody EmailTokenVerificationDto request) {
			boolean isValid = emailService.verifyEmailToken(request.getEmail(), request.getInputToken());
			return ResponseEntity.ok(isValid);
		}

		@GetMapping("/sendSms/{phone}")
		public ResponseEntity<String> sendSms(@PathVariable String phone) {
			String result = smsService.sendVerificationCode(phone);
			log.info("SMS 전송 결과: {}", result);
			return ResponseEntity.ok(result);
		}

		// SMS 인증 토큰 검증
		@PostMapping("/verify-sms-token")
		public ResponseEntity<Boolean> verifySmsCode(@RequestBody SmsTokenVerificationDto request) {
			boolean isValid = smsService.verifySmsCode(request.getPhone(), request.getInputToken());
			return ResponseEntity.ok(isValid);
		}

		@GetMapping("/email/phone/{phone}")
		public ResponseEntity<String> findEmailByPhone(@PathVariable String phone) {
			String email = authService.getEmailByPhone(phone);
			return ResponseEntity.ok(email);
		}
		
		@PostMapping("/refresh")
		public ResponseEntity<AccessTokenDto> newToken(@RequestBody Map<String, String> requestBody) {
			String refreshToken = requestBody.get("refreshToken");
			return ResponseEntity.ok(authService.refreshAccessToken(refreshToken));
		}
		
		
		// 로그인
		@PostMapping("/login")
		public ResponseEntity<?> login(@RequestBody LoginDto loginDto) {
			try {
				TokenDto tokenDto = authService.login(loginDto);
				log.info("tokenDto : {}", tokenDto);
				return ResponseEntity.ok(tokenDto);
			} catch (RuntimeException e) {
				log.error("로그인 실패: {}", e.getMessage());
				return ResponseEntity.badRequest().body(e.getMessage());
			}
		}
		
		@PostMapping("/change/password")
		public ResponseEntity<Boolean> changePassword(@RequestBody String pwd) {
				boolean isSuccess = emailService.changePassword(pwd, passwordEncoder); // 비밀번호 변경 로직 호출
				return ResponseEntity.ok(isSuccess); // 성공적으로 변경되었음을 true로 반환
		}
	}











