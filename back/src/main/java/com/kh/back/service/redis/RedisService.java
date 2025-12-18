package com.kh.back.service.redis;

import com.kh.back.service.action.ReActionService;
import com.kh.back.service.member.MemberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.*;

@Service @RequiredArgsConstructor
@Slf4j
public class RedisService {
	
	private final RedisTemplate<String, Object> redisTemplate;
	private final MemberService memberService;
	private final ReActionService reActionService;

	// Redis에 값 저장
	public void setValue(String key, String value) {
		redisTemplate.opsForValue().set(key, value);
	}
	// Redis에서 값 조회
	public String getValue(String key) {
		return (String) redisTemplate.opsForValue().get(key);
	}
	// Redis에서 값 삭제
	public void deleteValue(String key) {
		redisTemplate.delete(key);
	}
	// 좋아요 수 증가
	public Long incrementLikes(String postId) {
		String key = "likes:" + postId;
		return redisTemplate.opsForValue().increment(key, 1); // 1씩 증가
	}

	// 좋아요 수 감소
	public Long decrementLikes(String postId) {
		String key = "likes:" + postId;
		return redisTemplate.opsForValue().decrement(key, 1); // 1씩 감소
	}
	// 좋아요 수 조회
	public Long getLikes(String postId) {
		String key = "likes:" + postId;
		String value = (String) redisTemplate.opsForValue().get(key);  // Redis에서 값 가져오기
		log.warn("현재 좋아요 수 : {}", value);
		if (value != null) {
			return Long.parseLong(value);  // 문자열을 Long으로 변환
		}
		return 0L;  // 기본값
	}
	public Long getReports(String postId) {
		String key = "reports:" + postId;
		String value = (String) redisTemplate.opsForValue().get(key);
		if (value != null) {
			return Long.parseLong(value);
		}
		return 0L; // 기본값
	}
	public boolean updateRecipeCount(Authentication authentication, String action, String postId, String type, boolean increase) {
		try {
			String key = action + ":" + postId + ":" + type; // ex) likes:123:recipe 또는 reports:123:recipe
			if (increase) {
				redisTemplate.opsForValue().increment(key, 1); // +1 증가
				log.info("Increased value in Redis for key: {}", key);  // 로그 추가
				reActionService.updateAction(authentication, action, postId);
			} else {
				String value = Optional.ofNullable((String) redisTemplate.opsForValue().get(key)).orElse("0");
				redisTemplate.opsForValue().set(key, value); // null일 경우 0으로 설정
				redisTemplate.opsForValue().decrement(key, 1); // -1 감소
				log.info("Decreased value in Redis for key: {}", key);  // 로그 추가
				reActionService.deleteAction(authentication, postId, action);
			}
			return true;  // 성공
		} catch (Exception e) {
			e.printStackTrace();
			return false; // 실패
		}
	}

	public List<Map<String, Object>> getAllLikesAndReports() {
		List<Map<String, Object>> result = new ArrayList<>();
		// Redis에서 "likes:*" 패턴에 맞는 모든 키를 찾기
		Set<String> likeKeys = redisTemplate.keys("likes:*");
		if (likeKeys != null) {
			for (String key : likeKeys) {
				// 키에서 postId와 type 추출
				String[] parts = key.split(":");
				String postId = parts[1]; // Elasticsearch의 _id
				String type = parts[2];   // type (cocktail 또는 food)
				// Redis에서 해당 키의 값을 가져오기
				String value = (String) redisTemplate.opsForValue().get(key);
				if (value != null) {
					Map<String, Object> entry = new HashMap<>();
					entry.put("postId", postId); // Elasticsearch의 _id
					entry.put("type", type);     // type
					entry.put("value", Long.parseLong(value)); // 값
					entry.put("keyType", "like"); // 좋아요인지 신고인지 구분
					result.add(entry);
				}
			}
		}
		// Redis에서 "reports:*" 패턴에 맞는 모든 키를 찾기
		Set<String> reportKeys = redisTemplate.keys("reports:*");
		if (reportKeys != null) {
			for (String key : reportKeys) {
				// 키에서 postId와 type 추출
				String[] parts = key.split(":");
				String postId = parts[1]; // Elasticsearch의 _id
				String type = parts[2];   // type (cocktail 또는 food)

				// Redis에서 해당 키의 값을 가져오기
				String value = (String) redisTemplate.opsForValue().get(key);
				if (value != null) {
					Map<String, Object> entry = new HashMap<>();
					entry.put("postId", postId); // Elasticsearch의 _id
					entry.put("type", type);     // type
					entry.put("value", Long.parseLong(value)); // 값
					entry.put("keyType", "report"); // 좋아요인지 신고인지 구분
					result.add(entry);
				}
			}
		}

		return result;
	}




}

