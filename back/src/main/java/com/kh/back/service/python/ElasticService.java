package com.kh.back.service.python;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kh.back.dto.python.SearchListResDto;
import com.kh.back.dto.python.SearchResDto;
import com.kh.back.dto.recipe.res.CocktailListResDto;
import com.kh.back.dto.recipe.res.CocktailResDto;
import com.kh.back.dto.recipe.res.FoodListResDto;
import com.kh.back.dto.recipe.res.FoodResDto;
import com.kh.back.service.redis.RedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ElasticService {

	private final RestTemplate restTemplate;
	private final String flaskBaseUrl = "http://localhost:5001";
	private final ObjectMapper objectMapper;
	private final RedisService redisService;
	@Autowired
	private RedisTemplate<String, Object> redisTemplate;  // RedisTemplate 주입


	/**
	 * [통합 검색 메서드: 칵테일/음식]
	 * - 기존 오버로딩 메서드를 제거하고,
	 *   하나의 메서드로 통합.
	 * - 필요한 경우 cookingMethod를 빈 문자열("")로 전달.
	 *
	 * @param q             검색어 (빈 문자열이면 전체 검색)
	 * @param type          검색 타입 ("cocktail", "food", etc.)
	 * @param category      카테고리 (빈 문자열이면 필터 없음)
	 * @param cookingMethod 조리방법 (빈 문자열이면 필터 없음)
	 * @param page          페이지 번호
	 * @param size          페이지 당 항목 수
	 * @return 검색 결과 목록 (SearchListResDto)
	 */
	public List<SearchListResDto> search(String q, String type, String category, String cookingMethod, Integer page, Integer size) {
		try {
			String encodedQuery = URLEncoder.encode(q, StandardCharsets.UTF_8);
			String encodedType = URLEncoder.encode(type, StandardCharsets.UTF_8);

			String categoryParam = (category != null && !category.isEmpty())
					? "&category=" + URLEncoder.encode(category, StandardCharsets.UTF_8)
					: "";

			String methodParam = (cookingMethod != null && !cookingMethod.isEmpty())
					? "&cookingMethod=" + URLEncoder.encode(cookingMethod, StandardCharsets.UTF_8)
					: "";

			URI uri = new URI(flaskBaseUrl + "/search?q=" + encodedQuery
					+ "&type=" + encodedType
					+ categoryParam
					+ methodParam
					+ "&page=" + page
					+ "&size=" + size);

			log.info("[search] Calling Flask with URI: {}", uri);

			ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);
			log.info("[search] Flask response: {}", response);

			return convertResToList(response.getBody(), type);

		} catch (Exception e) {
			log.error("검색 중 에러 발생 (q={}, type={}, category={}, cookingMethod={}, page={}, size={}): {}",
					q, type, category, cookingMethod, page, size, e.getMessage());
			return null;
		}
	}

	/**
	 * [상세 조회 메서드]
	 * - 칵테일/음식 등 타입에 따라 적절한 DTO로 매핑
	 */
	public SearchResDto detail(String id, String type) {
		try {
			URI uri = new URI(flaskBaseUrl + "/detail/" + id + "?type=" + type);
			log.info("[detail] Calling Flask with URI: {}", uri);

			ResponseEntity<String> response = restTemplate.getForEntity(uri, String.class);
			log.info("[detail] Flask response: {}", response);

			return convertResToDto(response.getBody(), type);
		} catch (Exception e) {
			log.error("상세 조회 중 에러 (id={}, type={}): {}", id, type, e.getMessage());
			return null;
		}
	}

	/**
	 * [레시피 업로드 메서드]
	 * - 예: Flask의 /upload/one 엔드포인트 호출
	 */
	public String uploadRecipe(String jsonData) {
		try {
			URI uri = new URI(flaskBaseUrl + "/upload/one");
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);

			HttpEntity<String> requestEntity = new HttpEntity<>(jsonData, headers);
			ResponseEntity<String> response = restTemplate.postForEntity(uri, requestEntity, String.class);

			log.info("레시피 업로드 응답: {}", response.getBody());
			return response.getBody();
		} catch (Exception e) {
			log.error("레시피 업로드 중 에러 발생: {}", e.getMessage());
			return null;
		}
	}


	public String updateRecipe(String jsonData) {
		try {
			URI uri = new URI(flaskBaseUrl + "/update/one");
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);

			HttpEntity<String> requestEntity = new HttpEntity<>(jsonData, headers);
			ResponseEntity<String> response = restTemplate.postForEntity(uri, requestEntity, String.class);

			log.info("레시피 업로드 응답: {}", response.getBody());
			return response.getBody();
		} catch (Exception e) {
			log.error("레시피 업로드 중 에러 발생: {}", e.getMessage());
			return null;
		}
	}

	/**
	 * [검색 결과 변환 메서드]
	 * - JSON 응답 문자열을 List 형태로 변환
	 */
	public List<SearchListResDto> convertResToList(String response, String type) throws IOException {
		switch (type) {
			case "cocktail":
				return objectMapper.readValue(
						response,
						objectMapper.getTypeFactory().constructCollectionType(List.class, CocktailListResDto.class)
				);
			case "food":
				return objectMapper.readValue(
						response,
						objectMapper.getTypeFactory().constructCollectionType(List.class, FoodListResDto.class)
				);
			// 다른 타입은 필요 시 추가
			default:
				return null;
		}
	}

	/**
	 * [상세 정보 변환 메서드]
	 * - JSON 응답 문자열을 DTO 형태로 변환
	 */
	public SearchResDto convertResToDto(String response, String type) throws IOException {
		return switch (type) {
			case "cocktail" -> objectMapper.readValue(response, CocktailResDto.class);
			case "food" -> objectMapper.readValue(response, FoodResDto.class);
			// 다른 타입은 필요 시 추가
			default -> null;
		};
	}


	@Scheduled(fixedRate = 60000) // 60초마다 실행
	public void updateLikesAndReports() {
		try {
			List<Map<String, Object>> likeReportData = redisService.getAllLikesAndReports();
			if (likeReportData.isEmpty()) {
				log.info("[updateLikesAndReports] No like or report data found in Redis.");
				return;
			}

			Map<String, Object> requestBody = new HashMap<>();
			requestBody.put("like_report_data", likeReportData);

			String jsonData = objectMapper.writeValueAsString(requestBody);
			URI uri = new URI(flaskBaseUrl + "/update/likes-reports");

			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);
			HttpEntity<String> requestEntity = new HttpEntity<>(jsonData, headers);

			ResponseEntity<String> response = restTemplate.postForEntity(uri, requestEntity, String.class);
			log.info("[updateLikesAndReports] Response from Flask: {}", response.getBody());

			// Redis에서 데이터 삭제
			redisTemplate.execute((RedisCallback<Void>) connection -> {
				connection.flushAll();  // 모든 레디스 데이터를 삭제
				return null;
			});
			log.info("[updateLikesAndReports] All data cleared from Redis.");

		} catch (Exception e) {
			log.error("[updateLikesAndReports] Error sending like/report data to Flask: {}", e.getMessage());
		}
	}


	/**
	 * 특정 유저가 작성한 레시피 목록 조회 (Elasticsearch에서 가져옴)
	 *
	 * @param memberId 유저 ID
	 * @param page     페이지 번호
	 * @param size     페이지 당 항목 수
	 * @return 레시피 목록 (id, title, content_type)
	 */
	public List<Map<String, Object>> getUserRecipes(Long memberId, int page, int size) {
		try {
			// URL을 직접 문자열로 조합
			String url = flaskBaseUrl + "/api/profile/recipes?memberId=" + memberId
					+ "&page=" + page
					+ "&size=" + size;

			log.info("[getUserRecipes] Calling Flask with URL: {}", url);

			// API 호출
			ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

			// 응답을 List<Map<String, Object>> 형식으로 변환
			List<Map<String, Object>> responseBody = objectMapper.readValue(response.getBody(),
					new TypeReference<List<Map<String, Object>>>() {});

			log.info("[getUserRecipes] Flask response: {}", responseBody);

			return responseBody;
		} catch (Exception e) {
			log.error("[getUserRecipes] Error fetching user recipes", e);
			throw new RuntimeException("Error fetching user recipes", e);  // 예외 던지기
		}
	}
}
